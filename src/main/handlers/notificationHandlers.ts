import { ipcMain, BrowserWindow, Notification } from 'electron';
import { logger } from '../services/logger';

export function registerNotificationHandlers(getMainWindow: () => BrowserWindow | null): void {
  const supported = Notification.isSupported();
  logger.info(`Desktop notifications supported: ${supported}`, 'Notification');

  ipcMain.handle('show-notification', async (_event, title: string, body: string) => {
    logger.info(`show-notification IPC received: "${title}" — "${body}"`, 'Notification');

    if (!Notification.isSupported()) {
      logger.warn('Desktop notifications not supported on this platform', 'Notification');
      return;
    }

    const notification = new Notification({ title, body });

    notification.on('click', () => {
      const win = getMainWindow();
      if (win) {
        win.show();
        win.focus();
      }
    });

    notification.show();
    logger.info(`Notification.show() called for "${title}"`, 'Notification');
  });

  ipcMain.handle('is-window-focused', async () => {
    try {
      return getMainWindow()?.isFocused() ?? false;
    } catch (error) {
      logger.warn(`isFocused() query failed: ${(error as Error).message}`, 'Notification');
      return false;
    }
  });
}
