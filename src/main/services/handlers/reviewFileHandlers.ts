import { ipcMain, BrowserWindow } from 'electron';
import { reviewFileWatcher } from '../reviewFileWatcher';

/**
 * Register review file watching IPC handlers
 */
export function registerReviewFileHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('start-review-file-watcher', async (_event, filePath: string) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;

    reviewFileWatcher.start(filePath, (content) => {
      // Send file content to renderer when detected
      mainWindow.webContents.send('review-file-content-detected', content);
    });
  });

  ipcMain.handle('stop-review-file-watcher', async () => {
    reviewFileWatcher.stop();
  });

  ipcMain.handle('get-review-file-path', async () => {
    return reviewFileWatcher.getWatchedFilePath();
  });
}
