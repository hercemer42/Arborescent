import { PLUGINS } from '../../plugins.config';

export async function loadHandlers(): Promise<void> {
  for (const config of PLUGINS) {
    if (config.mainHandlersPath) {
      const module = await import(/* @vite-ignore */ config.mainHandlersPath);
      module.registerIpcHandlers();
    }
  }
}
