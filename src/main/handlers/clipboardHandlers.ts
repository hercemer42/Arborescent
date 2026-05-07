import { ipcMain, BrowserWindow } from 'electron';
import { clipboardMonitor } from '../services/clipboardMonitor';

export function registerClipboardHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('start-clipboard-monitor', async () => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;

    clipboardMonitor.start((content) => {
      mainWindow.webContents.send('clipboard-content-detected', content);
    });
  });

  ipcMain.handle('stop-clipboard-monitor', async () => {
    clipboardMonitor.stop();
  });

  ipcMain.handle('clipboard-monitor-record-self-write', async (_event, content: string) => {
    clipboardMonitor.recordSelfWrite(content);
  });
}
