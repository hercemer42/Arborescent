import { BrowserWindow } from 'electron';
import { BaseLogger } from '../../shared/services/logger/BaseLogger';

class MainLogger extends BaseLogger {
  error(message: string, error?: Error, context?: string, notifyRenderer = true): void {
    this.log('error', message, context, error);

    if (notifyRenderer) {
      const mainWindow = BrowserWindow.getAllWindows()[0];
      if (mainWindow) {
        mainWindow.webContents.send('main-error', message);
      }
    }
  }
}

export const logger = new MainLogger();
