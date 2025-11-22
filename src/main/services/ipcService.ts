import { BrowserWindow } from 'electron';
import { registerPluginHandlers } from '../../../plugins/core/main/registerHandlers';
import { registerFileHandlers } from './handlers/fileHandlers';
import { registerDialogHandlers } from './handlers/dialogHandlers';
import { registerSessionHandlers } from './handlers/sessionHandlers';
import { registerTempFileHandlers } from './handlers/tempFileHandlers';
import { registerClipboardHandlers } from './handlers/clipboardHandlers';
import { registerReviewFileHandlers } from './handlers/reviewFileHandlers';

/**
 * Register all IPC handlers
 * Coordinates registration of handlers from different modules
 */
export async function registerIpcHandlers(getMainWindow: () => BrowserWindow | null) {
  // Plugin system handlers
  await registerPluginHandlers();

  // Application handlers
  registerFileHandlers();
  registerDialogHandlers(getMainWindow);
  registerSessionHandlers();
  registerTempFileHandlers();
  registerClipboardHandlers(getMainWindow);
  registerReviewFileHandlers(getMainWindow);
}
