import { BrowserWindow } from 'electron';
import { registerFileHandlers } from './fileHandlers';
import { registerDialogHandlers } from './dialogHandlers';
import { registerSessionHandlers } from './sessionHandlers';
import { registerTempFileHandlers } from './tempFileHandlers';
import { registerClipboardHandlers } from './clipboardHandlers';
import { registerFeedbackFileHandlers } from './feedbackFileHandlers';
import { registerShellHandlers } from './shellHandlers';
import { registerPreferencesHandlers } from './preferencesHandlers';

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
