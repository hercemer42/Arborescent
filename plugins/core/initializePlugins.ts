import { PluginRegistry } from './PluginRegistry';
import { PluginManager } from './PluginManager';
import { PLUGINS } from '../plugins.config';

export async function initializeBuiltinPlugins(): Promise<void> {
  await PluginManager.start();

  for (const config of PLUGINS) {
    if (config.rendererRegisterPath) {
      const module = await import(config.rendererRegisterPath);
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

export async function disposeBuiltinPlugins(): Promise<void> {
  await PluginManager.disposePlugins();
  await PluginManager.stop();
}
