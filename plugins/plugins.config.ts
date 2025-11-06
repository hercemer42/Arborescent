export interface PluginConfig {
  name: string;
  pluginPath: string;
  manifestPath: string;
  mainRegisterPath?: string;
  rendererRegisterPath?: string;
}

interface PluginConfigModule {
  config: PluginConfig;
}

const pluginConfigModules = import.meta.glob<PluginConfigModule>('./*/plugin.config.ts', {
  eager: true
});

export const PLUGINS: PluginConfig[] = Object.values(pluginConfigModules).map(
  (module) => module.config
);
