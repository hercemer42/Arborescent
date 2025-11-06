import type { PluginConfig, PluginConfigModule } from './core/types/pluginConfig';

const pluginConfigModules = import.meta.glob<PluginConfigModule>('./*/plugin.config.ts', {
  eager: true
});

export const PLUGINS: PluginConfig[] = Object.values(pluginConfigModules).map(
  (module) => module.config
);

export type { PluginConfig };
