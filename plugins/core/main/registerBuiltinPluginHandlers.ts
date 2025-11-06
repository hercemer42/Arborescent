import { PLUGINS } from '../../plugins.config';

export async function registerBuiltinPluginHandlers(): Promise<void> {
  for (const config of PLUGINS) {
    if (config.mainRegisterPath) {
      const module = await import(config.mainRegisterPath);
      module.registerIpcHandlers();
    }
  }
}
