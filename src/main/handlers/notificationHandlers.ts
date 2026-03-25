import { ipcMain, BrowserWindow, Notification } from 'electron';
import { logger } from '../services/logger';

let windowFocused = false;

export function registerNotificationHandlers(getMainWindow: () => BrowserWindow | null): void {
  const mainWindow = getMainWindow();
  if (mainWindow) {
    mainWindow.on('focus', () => { windowFocused = true; });
    mainWindow.on('blur', () => { windowFocused = false; });
    windowFocused = mainWindow.isFocused();
  } else {
    windowFocused = false;
  }

  const supported = Notification.isSupported();
  logger.info(`Desktop notifications supported: ${supported}`, 'Notification');

  ipcMain.handle('show-notification', async (_event, title: string, body: string) => {
    if (!Notification.isSupported()) {
      logger.warn('Desktop notifications not supported on this platform', 'Notification');
      return;
    }

    logger.info(`Showing notification: "${title}" — "${body}"`, 'Notification');

    const notification = new Notification({ title, body });

    notification.on('click', () => {
      const win = getMainWindow();
      if (win) {
        win.show();
        win.focus();
      }
    });

    notification.show();
  });

  ipcMain.handle('is-window-focused', async () => {
    return windowFocused;
  });
}
