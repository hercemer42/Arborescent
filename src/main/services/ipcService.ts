import { BrowserWindow } from 'electron';
import { registerFileHandlers } from './handlers/fileHandlers';
import { registerDialogHandlers } from './handlers/dialogHandlers';
import { registerSessionHandlers } from './handlers/sessionHandlers';
import { registerTempFileHandlers } from './handlers/tempFileHandlers';
import { registerClipboardHandlers } from './handlers/clipboardHandlers';
import { registerFeedbackFileHandlers } from './handlers/feedbackFileHandlers';
import { registerShellHandlers } from './handlers/shellHandlers';
import { registerPreferencesHandlers } from './handlers/preferencesHandlers';

export async function registerIpcHandlers(getMainWindow: () => BrowserWindow | null) {
  registerFileHandlers();
  registerDialogHandlers(getMainWindow);
  registerSessionHandlers();
  registerTempFileHandlers();
  registerClipboardHandlers(getMainWindow);
  registerFeedbackFileHandlers(getMainWindow);
  registerShellHandlers();
  registerPreferencesHandlers();
}
