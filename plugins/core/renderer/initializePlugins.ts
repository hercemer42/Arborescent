import { PluginRegistry } from './Registry';
import { PluginManager } from './Manager';
import { PLUGINS } from '../../plugins.config';

/**
 * Registers all plugins by:
 * 1. Starting the plugin worker thread
 * 2. Loading and registering renderer commands
 * 3. Registering plugin metadata with PluginManager (for worker) and PluginRegistry (for UI)
 */
export async function registerPlugins(): Promise<void> {
  await PluginManager.start();

  for (const config of PLUGINS) {
    if (config.rendererCommandsPath) {
      // Dynamic import requires vite-ignore since path is determined at runtime
      const module = await import(/* @vite-ignore */ config.rendererCommandsPath);
      module.registerCommands();
    }

    const plugin = await PluginManager.registerPlugin({
      name: config.name,
      pluginPath: config.pluginPath,
      manifestPath: config.manifestPath,
    });

    await PluginRegistry.register(plugin);
  }
}

export async function disposePlugins(): Promise<void> {
  await PluginManager.disposePlugins();
  await PluginManager.stop();
}
