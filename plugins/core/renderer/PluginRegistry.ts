import { Plugin } from '../shared/pluginInterface';
import { usePluginStore } from '../../../src/renderer/store/plugins/pluginStore';
import { logger } from '../../../src/renderer/services/logger';
import { notifyError } from '../../../src/renderer/utils/errorNotification';
import { checkApiCompatibility } from '../shared/pluginApiVersion';

class PluginRegistryClass {
  private plugins: Map<string, Plugin> = new Map();
  private initialized = false;

  private handleInitializationError(plugin: Plugin, error: Error): void {
    notifyError(
      `Plugin "${plugin.manifest.displayName}" failed to initialize`,
      error,
      'Plugin Registry'
    );
  }

  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.manifest.name)) {
      logger.warn(`Plugin ${plugin.manifest.name} is already registered`, 'Plugin Registry');
      return;
    }

    const compatibility = checkApiCompatibility(plugin.manifest.apiVersion);
    if (!compatibility.compatible) {
      notifyError(
        `Plugin "${plugin.manifest.displayName}": ${compatibility.warning}`,
        new Error(compatibility.warning),
        'Plugin Registry'
      );
      return;
    }

    this.plugins.set(plugin.manifest.name, plugin);
    usePluginStore.getState().registerPlugin(plugin);

    if (this.initialized && plugin.manifest.enabled) {
      try {
        await plugin.initialize();
        logger.info(`Plugin ${plugin.manifest.name} initialized`, 'Plugin Registry');
      } catch (error) {
        this.handleInitializationError(plugin, error as Error);
      }
    }

    logger.info(`Plugin ${plugin.manifest.name} registered`, 'Plugin Registry');
  }

  async unregister(pluginName: string): Promise<void> {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      return;
    }

    try {
      plugin.dispose();
    } catch (error) {
      logger.error(
        `Failed to dispose plugin ${pluginName}`,
        error as Error,
        'Plugin Registry'
      );
    }

    this.plugins.delete(pluginName);
    usePluginStore.getState().unregisterPlugin(pluginName);

    logger.info(`Plugin ${pluginName} unregistered`, 'Plugin Registry');
  }

  async initializeAll(): Promise<void> {
    const enabledPlugins = Array.from(this.plugins.values()).filter(
      (p) => p.manifest.enabled
    );

    await Promise.all(
      enabledPlugins.map(async (plugin) => {
        try {
          await plugin.initialize();
          logger.info(`Plugin ${plugin.manifest.name} initialized`, 'Plugin Registry');
        } catch (error) {
          this.handleInitializationError(plugin, error as Error);
        }
      })
    );

    this.initialized = true;
    logger.info('All plugins initialized', 'Plugin Registry');
  }

  async disposeAll(): Promise<void> {
    await Promise.all(
      Array.from(this.plugins.values()).map(async (plugin) => {
        try {
          plugin.dispose();
        } catch (error) {
          logger.error(
            `Failed to dispose plugin ${plugin.manifest.name}`,
            error as Error,
            'Plugin Registry'
          );
        }
      })
    );

    this.plugins.clear();
    this.initialized = false;

    logger.info('All plugins disposed', 'Plugin Registry');
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabledPlugins(): Plugin[] {
    return Array.from(this.plugins.values()).filter((p) => p.manifest.enabled);
  }

  async enablePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }

    plugin.manifest.enabled = true;
    usePluginStore.getState().enablePlugin(name);

    if (this.initialized) {
      try {
        await plugin.initialize();
        logger.info(`Plugin ${name} enabled and initialized`, 'Plugin Registry');
      } catch (error) {
        this.handleInitializationError(plugin, error as Error);
      }
    } else {
      logger.info(`Plugin ${name} enabled`, 'Plugin Registry');
    }
  }

  async disablePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }

    plugin.manifest.enabled = false;

    try {
      plugin.dispose();
    } catch (error) {
      logger.error(
        `Failed to dispose plugin ${name}`,
        error as Error,
        'Plugin Registry'
      );
    }

    usePluginStore.getState().disablePlugin(name);

    logger.info(`Plugin ${name} disabled`, 'Plugin Registry');
  }
}

export const PluginRegistry = new PluginRegistryClass();
