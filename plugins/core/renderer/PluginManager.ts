import { PluginProxy } from './PluginProxy';
import { Plugin, PluginManifest } from '../shared/pluginInterface';
import { logger } from '../../../src/renderer/services/logger';
import { notifyError } from '../../../src/renderer/utils/errorNotification';

interface PluginRegistration {
  name: string;
  pluginPath: string;
  manifestPath: string;
}

/**
 * PluginManager coordinates plugin worker thread communication from the renderer process.
 *
 * This class is part of a dual-tracking system:
 * - PluginManager: Manages worker thread lifecycle and IPC communication
 * - PluginRegistry: Manages UI state (enabled/disabled status, Zustand store)
 *
 * Key responsibilities:
 * - Start/stop the plugin worker thread
 * - Register plugins with the worker (send manifest and paths)
 * - Initialize plugin instances in the worker
 * - Create PluginProxy instances that forward extension point calls to the worker
 * - Dispose plugins and clean up resources
 *
 * Architecture:
 * 1. Renderer (this class) → IPC → Main Process → Worker Thread → Plugin Code
 * 2. PluginProxy instances act as local stubs, forwarding calls to the worker
 * 3. All actual plugin logic executes in the isolated worker thread
 *
 * Thread Safety:
 * - Prevents concurrent start operations with startPromise
 * - Ensures operations wait for start to complete before proceeding
 */
class PluginManagerClass {
  private started = false;
  private pluginProxies: Map<string, PluginProxy> = new Map();
  private startPromise: Promise<void> | null = null;

  /**
   * Starts the plugin worker thread.
   * Safe to call multiple times - subsequent calls wait for the first to complete.
   */
  async start(): Promise<void> {
    if (this.started) {
      logger.warn('Plugin system already started', 'Plugin Manager');
      return;
    }

    if (this.startPromise) {
      logger.info('Plugin system start already in progress, waiting...', 'Plugin Manager');
      return this.startPromise;
    }

    this.startPromise = this._doStart();
    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async _doStart(): Promise<void> {
    const response = await window.electron.pluginStart();
    if (!response.success) {
      const error = response.error || 'Failed to start plugin system';
      const errorObj = new Error(error);
      notifyError(`Plugin system failed to start: ${error}`, errorObj, 'Plugin Manager');
      throw errorObj;
    }

    this.started = true;
    logger.info('Plugin manager started', 'Plugin Manager');
  }

  /**
   * Stops the plugin worker thread and clears all plugin proxies.
   * Waits for any pending start operation to complete first.
   */
  async stop(): Promise<void> {
    if (this.startPromise) {
      logger.info('Waiting for start to complete before stopping', 'Plugin Manager');
      await this.startPromise;
    }

    if (!this.started) {
      return;
    }

    await window.electron.pluginStop();
    this.started = false;
    this.pluginProxies.clear();

    logger.info('Plugin manager stopped', 'Plugin Manager');
  }

  /**
   * Registers a plugin with the worker thread and creates a local PluginProxy.
   *
   * The registration process:
   * 1. Sends plugin metadata (name, paths) to worker via IPC
   * 2. Worker loads the manifest and validates the plugin
   * 3. Creates a PluginProxy in renderer to forward extension point calls
   *
   * The plugin code is NOT loaded yet - that happens during initializePlugins().
   *
   * @param registration - Plugin metadata (name, pluginPath, manifestPath)
   * @returns PluginProxy instance that forwards calls to the worker
   * @throws Error if plugin system not started or registration fails
   */
  async registerPlugin(registration: PluginRegistration): Promise<Plugin> {
    if (this.startPromise) {
      logger.info('Waiting for start to complete before registering plugin', 'Plugin Manager');
      await this.startPromise;
    }

    if (!this.started) {
      throw new Error('Plugin system not started');
    }

    const { name, pluginPath, manifestPath } = registration;

    const response = await window.electron.pluginRegister(name, pluginPath, manifestPath);

    if (!response.success || !response.manifest) {
      const error = response.error || `Failed to register plugin ${name}`;
      const errorObj = new Error(error);
      notifyError(`Plugin registration failed: ${error}`, errorObj, 'Plugin Manager');
      throw errorObj;
    }

    const proxy = new PluginProxy(name, response.manifest as PluginManifest);
    this.pluginProxies.set(name, proxy);

    logger.info(`Plugin ${name} registered`, 'Plugin Manager');

    return proxy;
  }

  /**
   * Unregisters a plugin from the worker thread.
   * Removes the plugin from the worker and deletes the local proxy.
   *
   * @param name - Plugin name to unregister
   */
  async unregisterPlugin(name: string): Promise<void> {
    if (!this.started) {
      return;
    }

    await window.electron.pluginUnregister(name);
    this.pluginProxies.delete(name);

    logger.info(`Plugin ${name} unregistered`, 'Plugin Manager');
  }

  /**
   * Initializes all registered plugins in the worker thread.
   *
   * This is when plugin code is actually loaded and executed:
   * 1. Worker loads the plugin module (lazy loading)
   * 2. Instantiates the plugin class
   * 3. Calls plugin.initialize() in the worker
   * 4. Plugin can now use context.invokeIPC() to access main process functionality
   *
   * Must be called after registerPlugin() for each plugin.
   * This is separate from registration to support lazy loading.
   *
   * @throws Error if plugin system not started or initialization fails
   */
  async initializePlugins(): Promise<void> {
    if (this.startPromise) {
      await this.startPromise;
    }

    if (!this.started) {
      throw new Error('Plugin system not started');
    }

    const response = await window.electron.pluginInitializeAll();
    if (!response.success) {
      throw new Error(response.error || 'Failed to initialize plugins');
    }

    logger.info('All plugins initialized', 'Plugin Manager');
  }

  /**
   * Disposes all plugins in the worker thread.
   *
   * Calls plugin.dispose() on each plugin instance in the worker,
   * allowing them to clean up resources (timers, subscriptions, etc.).
   * Also clears all local plugin proxies.
   */
  async disposePlugins(): Promise<void> {
    if (!this.started) {
      return;
    }

    await window.electron.pluginDisposeAll();
    this.pluginProxies.clear();

    logger.info('All plugins disposed', 'Plugin Manager');
  }

  /**
   * Gets a plugin proxy by name.
   * The proxy forwards extension point calls to the worker thread.
   *
   * @param name - Plugin name
   * @returns PluginProxy instance or undefined if not found
   */
  getPluginProxy(name: string): Plugin | undefined {
    return this.pluginProxies.get(name);
  }
}

export const PluginManager = new PluginManagerClass();
