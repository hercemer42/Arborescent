export interface PluginConfig {
  name: string;
  pluginPath: string;
  manifestPath: string;
  mainRegisterPath?: string;
  rendererRegisterPath?: string;
}

export interface PluginConfigModule {
  config: PluginConfig;
}
