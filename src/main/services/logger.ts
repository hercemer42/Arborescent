import { BaseLogger } from '../../shared/services/logger/BaseLogger';

let electronModule: typeof import('electron') | null = null;

export function setElectronModule(mod: typeof import('electron') | null): void {
  electronModule = mod;
}

class MainLogger extends BaseLogger {
  error(message: string, error?: Error, context?: string, notifyRenderer = true): void {
    this.log('error', message, context, error);

    if (notifyRenderer) {
      try {
        const electron =
          electronModule ??
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          require('electron');
        const mainWindow = electron.BrowserWindow.getAllWindows()[0];
        if (mainWindow) {
          mainWindow.webContents.send('main-error', message);
        }
      } catch {
        // Electron not available (e.g., in worker thread)
      }
    }
  }
}

export const logger = new MainLogger();
