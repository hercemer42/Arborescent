import { PluginProxy } from './PluginProxy';
import { Plugin, PluginManifest } from './pluginInterface';
import { logger } from '../../src/renderer/services/logger';
import { notifyError } from '../../src/renderer/utils/errorNotification';

interface PluginRegistration {
  name: string;
  pluginPath: string;
  manifestPath: string;
}

class PluginManagerClass {
  private started = false;
  private pluginProxies: Map<string, PluginProxy> = new Map();
  private startPromise: Promise<void> | null = null;

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

  async unregisterPlugin(name: string): Promise<void> {
    if (!this.started) {
      return;
    }

    await window.electron.pluginUnregister(name);
    this.pluginProxies.delete(name);

    logger.info(`Plugin ${name} unregistered`, 'Plugin Manager');
  }

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

  async disposePlugins(): Promise<void> {
    if (!this.started) {
      return;
    }

    await window.electron.pluginDisposeAll();
    this.pluginProxies.clear();

    logger.info('All plugins disposed', 'Plugin Manager');
  }

  getPluginProxy(name: string): Plugin | undefined {
    return this.pluginProxies.get(name);
  }
}

export const PluginManager = new PluginManagerClass();
