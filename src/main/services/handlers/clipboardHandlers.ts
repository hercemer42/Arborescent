import { ipcMain, BrowserWindow } from 'electron';
import { clipboardMonitor } from '../clipboardMonitor';

/**
 * Register clipboard monitoring IPC handlers
 */
export function registerClipboardHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('start-clipboard-monitor', async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;

    clipboardMonitor.start((content) => {
      // Send clipboard content to renderer when detected
      mainWindow.webContents.send('clipboard-content-detected', content);
    });
  });

  ipcMain.handle('stop-clipboard-monitor', async () => {
    clipboardMonitor.stop();
  });
}
