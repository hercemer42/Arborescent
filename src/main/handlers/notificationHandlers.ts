import { ipcMain, BrowserWindow, Notification } from 'electron';

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

  ipcMain.handle('show-notification', async (_event, title: string, body: string) => {
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
