import { BaseLogger } from '../../shared/services/logger/BaseLogger';

class MainLogger extends BaseLogger {
  error(message: string, error?: Error, context?: string, notifyRenderer = true): void {
    this.log('error', message, context, error);

    if (notifyRenderer) {
      try {
        // Lazy import electron to avoid errors when loaded in worker context
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { BrowserWindow } = require('electron');
        const mainWindow = BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
          mainWindow.webContents.send('main-error', message);
        }
      } catch {
        // Electron not available (e.g., in worker thread) - skip renderer notification
      }
    }
  }
}

export const logger = new MainLogger();
