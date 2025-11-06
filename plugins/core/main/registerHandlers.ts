import { registerIpcHandlers } from './ipcHandlers';
import { loadHandlers } from './loadHandlers';

export async function registerHandlers(): Promise<void> {
  registerIpcHandlers();
  await loadHandlers();
}
