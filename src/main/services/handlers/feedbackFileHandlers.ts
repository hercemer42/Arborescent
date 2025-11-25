import { ipcMain, BrowserWindow } from 'electron';
import { feedbackFileWatcher } from '../feedbackFileWatcher';

/**
 * Register feedback file watching IPC handlers
 */
export function registerFeedbackFileHandlers(getMainWindow: () => BrowserWindow | null): void {
  ipcMain.handle('start-feedback-file-watcher', async (_event, filePath: string) => {
    const mainWindow = getMainWindow();
    if (!mainWindow) return;

    feedbackFileWatcher.start(filePath, (content) => {
      // Send file content to renderer when detected
      mainWindow.webContents.send('feedback-file-content-detected', content);
    });
  });

  ipcMain.handle('stop-feedback-file-watcher', async () => {
    feedbackFileWatcher.stop();
  });

  ipcMain.handle('get-feedback-file-path', async () => {
    return feedbackFileWatcher.getWatchedFilePath();
  });
}
