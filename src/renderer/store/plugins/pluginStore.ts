import { create } from 'zustand';
import { Plugin } from '../../../../plugins/core/pluginInterface';

interface PluginState {
  plugins: Plugin[];
  enabledPlugins: Plugin[];

  registerPlugin: (plugin: Plugin) => void;
  unregisterPlugin: (pluginName: string) => void;
  enablePlugin: (pluginName: string) => void;
  disablePlugin: (pluginName: string) => void;
}

export const usePluginStore = create<PluginState>((set, get) => ({
  plugins: [],
  enabledPlugins: [],

  registerPlugin: (plugin: Plugin) => {
    const { plugins } = get();

    if (plugins.some(p => p.manifest.name === plugin.manifest.name)) {
      console.warn(`Plugin ${plugin.manifest.name} is already registered`);
      return;
    }

    const newPlugins = [...plugins, plugin];
    const newEnabledPlugins = plugin.manifest.enabled
      ? [...get().enabledPlugins, plugin]
      : get().enabledPlugins;

    set({
      plugins: newPlugins,
      enabledPlugins: newEnabledPlugins,
    });
  },

  unregisterPlugin: (pluginName: string) => {
    const { plugins, enabledPlugins } = get();

    set({
      plugins: plugins.filter(p => p.manifest.name !== pluginName),
      enabledPlugins: enabledPlugins.filter(p => p.manifest.name !== pluginName),
    });
  },

  enablePlugin: (pluginName: string) => {
    const { plugins, enabledPlugins } = get();
    const plugin = plugins.find(p => p.manifest.name === pluginName);

    if (!plugin) {
      console.warn(`Plugin ${pluginName} not found`);
      return;
    }

    if (enabledPlugins.some(p => p.manifest.name === pluginName)) {
      return;
    }

    plugin.manifest.enabled = true;
    set({
      enabledPlugins: [...enabledPlugins, plugin],
    });
  },

  disablePlugin: (pluginName: string) => {
    const { plugins, enabledPlugins } = get();
    const plugin = plugins.find(p => p.manifest.name === pluginName);

    if (!plugin) {
      console.warn(`Plugin ${pluginName} not found`);
      return;
    }

    plugin.manifest.enabled = false;
    set({
      enabledPlugins: enabledPlugins.filter(p => p.manifest.name !== pluginName),
    });
  },
}));
