import { AIPlugin } from './pluginInterface';

class PluginRegistryClass {
  private plugins: Map<string, AIPlugin> = new Map();
  private initialized = false;

  async register(plugin: AIPlugin): Promise<void> {
    if (this.plugins.has(plugin.manifest.name)) {
      console.warn(`Plugin ${plugin.manifest.name} is already registered`);
      return;
    }

    this.plugins.set(plugin.manifest.name, plugin);

    if (this.initialized && plugin.manifest.enabled) {
      await plugin.initialize();
    }
  }

  unregister(pluginName: string): void {
    const plugin = this.plugins.get(pluginName);
    if (plugin) {
      plugin.dispose();
      this.plugins.delete(pluginName);
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

  getPlugin(name: string): AIPlugin | undefined {
    return this.plugins.get(name);
  }

  getAllPlugins(): AIPlugin[] {
    return Array.from(this.plugins.values());
  }

  getEnabledPlugins(): AIPlugin[] {
    return Array.from(this.plugins.values()).filter((p) => p.manifest.enabled);
  }

  async enablePlugin(name: string): Promise<void> {
    const plugin = this.plugins.get(name);
    if (!plugin) {
      throw new Error(`Plugin ${name} not found`);
    }

    plugin.manifest.enabled = true;

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
  }
}

export const PluginRegistry = new PluginRegistryClass();
