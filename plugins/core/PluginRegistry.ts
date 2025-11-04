import { Plugin } from './pluginInterface';
import { usePluginStore } from '../../src/renderer/store/plugins/pluginStore';

class PluginRegistryClass {
  private plugins: Map<string, Plugin> = new Map();
  private initialized = false;

  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.manifest.name)) {
      console.warn(`Plugin ${plugin.manifest.name} is already registered`);
      return;
    }

    this.plugins.set(plugin.manifest.name, plugin);
    usePluginStore.getState().registerPlugin(plugin);

    if (this.initialized && plugin.manifest.enabled) {
      await plugin.initialize();
    }
  }

  unregister(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      plugin.dispose();
      this.plugins.delete(pluginName);
      usePluginStore.getState().unregisterPlugin(pluginName);
    }
  }

  async initializeAll(): Promise<void> {
    const enabledPlugins = Array.from(this.plugins.values()).filter(
      (p) => p.manifest.enabled
    );

    await Promise.all(enabledPlugins.map((plugin) => plugin.initialize()));
    this.initialized = true;
  }

  disposeAll(): void {
    this.plugins.forEach((plugin) => plugin.dispose());
    this.plugins.clear();
    this.initialized = false;
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
      await plugin.initialize();
    }
  }

  disablePlugin(name: string): void {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }

    plugin.manifest.enabled = false;
    plugin.dispose();
    usePluginStore.getState().disablePlugin(name);
  }
}

export const PluginRegistry = new PluginRegistryClass();
