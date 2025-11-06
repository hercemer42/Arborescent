import { registerPluginIpcHandlers } from './ipcHandlers';
import { loadPluginHandlers } from './loadHandlers';

export async function registerPluginHandlers(): Promise<void> {
  registerPluginIpcHandlers();
  await loadPluginHandlers();
}
