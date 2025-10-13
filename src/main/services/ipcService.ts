import { ipcMain, dialog, BrowserWindow } from 'electron';
import { promises as fs } from 'node:fs';
import { logger } from './logger';

export function registerIpcHandlers(getMainWindow: () => BrowserWindow | null) {
  ipcMain.handle('read-file', async (_, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      logger.info(`File read: ${filePath}`, 'IPC');
      return content;
    } catch (error) {
      const message = `Failed to read file: ${filePath}`;
      logger.error(message, error instanceof Error ? error : undefined, 'IPC', true);
      throw error;
    }
  });

  ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
    try {
      await fs.writeFile(filePath, content, 'utf-8');
      logger.info(`File written: ${filePath}`, 'IPC');
    } catch (error) {
      const message = `Failed to write file: ${filePath}`;
      logger.error(message, error instanceof Error ? error : undefined, 'IPC', true);
      throw error;
    }
  });

  ipcMain.handle('show-open-dialog', async () => {
    const mainWindow = getMainWindow();
    logger.info('Opening file dialog', 'IPC');

    const options = {
      properties: ['openFile' as const],
      filters: [{ name: 'Arborescent Files', extensions: ['json'] }],
    };

    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);

    logger.info(`Dialog result received, canceled: ${result.canceled}, path: ${result.filePaths[0] || 'none'}`, 'IPC');

    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('show-save-dialog', async () => {
    const mainWindow = getMainWindow();
    const options = {
      filters: [{ name: 'Arborescent Files', extensions: ['json'] }],
    };

    const result = mainWindow
      ? await dialog.showSaveDialog(mainWindow, options)
      : await dialog.showSaveDialog(options);

    return result.canceled ? null : result.filePath;
  });
}
