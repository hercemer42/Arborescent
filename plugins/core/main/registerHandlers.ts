import { registerPluginIpcHandlers } from './ipcSystemHandlers';
import { loadPluginHandlers } from './loadHandlers';

/**
 * Registers all plugin-related IPC handlers.
 *
 * This orchestrates the two-layer IPC setup:
 * 1. System handlers - Control plugin lifecycle (start/stop/register/invoke)
 * 2. Plugin handlers - API surface for plugins (loaded from each plugin's bundle)
 *
 * Called once during app initialization to set up the complete plugin IPC infrastructure.
 */
export async function registerPluginHandlers(): Promise<void> {
  registerPluginIpcHandlers();
  await loadPluginHandlers();
}
