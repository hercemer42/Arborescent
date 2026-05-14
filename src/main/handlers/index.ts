import { BrowserWindow } from 'electron';
import { registerAppHandlers } from './appHandlers';
import { registerFileHandlers } from './fileHandlers';
import { registerDialogHandlers } from './dialogHandlers';
import { registerSessionHandlers } from './sessionHandlers';
import { registerTempFileHandlers } from './tempFileHandlers';
import { registerClipboardHandlers } from './clipboardHandlers';
import { registerFeedbackFileHandlers } from './feedbackFileHandlers';
import { registerShellHandlers } from './shellHandlers';
import { registerPreferencesHandlers } from './preferencesHandlers';
import { registerNotificationHandlers } from './notificationHandlers';
import { registerKeepAwakeHandlers } from './keepAwakeHandlers';
import { registerLogHandlers } from './logHandlers';

// Note: terminal handlers (registerTerminalHandlers) are registered
// separately in main.ts after window creation because they require the
// hook-server environment variables, which depend on the port allocated
// at startup. All other IPC is wired through this aggregator.
export async function registerIpcHandlers(getMainWindow: () => BrowserWindow | null) {
  registerAppHandlers(getMainWindow);
  registerFileHandlers();
  registerDialogHandlers(getMainWindow);
  registerSessionHandlers();
  registerTempFileHandlers();
  registerClipboardHandlers(getMainWindow);
  registerFeedbackFileHandlers(getMainWindow);
  registerShellHandlers();
  registerPreferencesHandlers();
  registerNotificationHandlers(getMainWindow);
  registerKeepAwakeHandlers();
  registerLogHandlers();
}
