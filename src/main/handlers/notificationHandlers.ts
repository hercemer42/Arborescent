import { ipcMain, BrowserWindow, Notification } from 'electron';

export function registerNotificationHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('show-notification', async (_event, title: string, body: string) => {
    const notification = new Notification({ title, body });

    notification.on('click', () => {
      const mainWindow = getMainWindow();
      if (mainWindow) {
        mainWindow.show();
        mainWindow.focus();
      }
    });

    notification.show();
  });

  ipcMain.handle('is-window-focused', async () => {
    const mainWindow = getMainWindow();
    return mainWindow?.isFocused() ?? false;
  });
}
