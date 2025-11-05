import { PluginProxy } from './PluginProxy';
import { Plugin } from './pluginInterface';
import { logger } from '../../src/renderer/services/logger';

interface PluginRegistration {
  name: string;
  pluginPath: string;
  manifestPath: string;
}

class ExtensionHostManagerClass {
  private started = false;
  private pluginProxies: Map<string, PluginProxy> = new Map();
  private startPromise: Promise<void> | null = null;

  async start(): Promise<void> {
    if (this.started) {
      logger.warn('Extension host already started', 'Extension Host Manager');
      return;
    }

    if (this.startPromise) {
      logger.info('Extension host start already in progress, waiting...', 'Extension Host Manager');
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
    const response = await window.electron.extensionHostStart();
    if (!response.success) {
      throw new Error(response.error || 'Failed to start extension host');
    }

    this.started = true;
    logger.info('Extension host manager started', 'Extension Host Manager');
  }

  async stop(): Promise<void> {
    if (this.startPromise) {
      logger.info('Waiting for start to complete before stopping', 'Extension Host Manager');
      await this.startPromise;
    }

    if (!this.started) {
      return;
    }

    await window.electron.extensionHostStop();
    this.started = false;
    this.pluginProxies.clear();

    logger.info('Extension host manager stopped', 'Extension Host Manager');
  }

  async registerPlugin(registration: PluginRegistration): Promise<Plugin> {
    if (this.startPromise) {
      logger.info('Waiting for start to complete before registering plugin', 'Extension Host Manager');
      await this.startPromise;
    }

    if (!this.started) {
      throw new Error('Extension host not started');
    }

    const { name, pluginPath, manifestPath } = registration;

    const response = await window.electron.extensionHostRegisterPlugin(name, pluginPath, manifestPath);

    if (!response.success || !response.manifest) {
      throw new Error(response.error || `Failed to register plugin ${name}`);
    }

    const proxy = new PluginProxy(name, response.manifest);
    this.pluginProxies.set(name, proxy);

    logger.info(`Plugin ${name} registered`, 'Extension Host Manager');

    return proxy;
  }

  async unregisterPlugin(name: string): Promise<void> {
    if (!this.started) {
      return;
    }

    await window.electron.extensionHostUnregisterPlugin(name);
    this.pluginProxies.delete(name);

    logger.info(`Plugin ${name} unregistered`, 'Extension Host Manager');
  }

  async initializePlugins(): Promise<void> {
    if (this.startPromise) {
      await this.startPromise;
    }

    if (!this.started) {
      throw new Error('Extension host not started');
    }

    const response = await window.electron.extensionHostInitializePlugins();
    if (!response.success) {
      throw new Error(response.error || 'Failed to initialize plugins');
    }

    logger.info('All plugins initialized in extension host', 'Extension Host Manager');
  }

  async disposePlugins(): Promise<void> {
    if (!this.started) {
      return;
    }

    await window.electron.extensionHostDisposePlugins();
    this.pluginProxies.clear();

    logger.info('All plugins disposed in extension host', 'Extension Host Manager');
  }

  getPluginProxy(name: string): Plugin | undefined {
    return this.pluginProxies.get(name);
  }
}

export const ExtensionHostManager = new ExtensionHostManagerClass();
