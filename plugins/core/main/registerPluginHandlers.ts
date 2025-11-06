import { registerPluginIpcHandlers } from './pluginIpcHandlers';
import { loadPluginHandlers } from './loadPluginHandlers';

export async function registerPluginHandlers(): Promise<void> {
  registerPluginIpcHandlers();
  await loadPluginHandlers();
}
