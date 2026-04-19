import { app, BrowserWindow, ipcMain } from 'electron';

export function registerAppHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('replace-misspelling', (_event, suggestion: string) => {
    getMainWindow()?.webContents.replaceMisspelling(suggestion);
  });

  ipcMain.handle('app-quit', () => {
    app.quit();
  });
}
