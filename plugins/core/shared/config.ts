export interface PluginConfig {
  name: string;
  pluginPath: string;
  manifestPath: string;
  mainHandlersPath?: string;
  rendererCommandsPath?: string;
}

export interface PluginConfigModule {
  config: PluginConfig;
}
