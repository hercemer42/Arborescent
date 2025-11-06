import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { logger } from './logger';
import { registerPluginHandlers } from '../../../plugins/core/main/registerPluginHandlers';

export async function registerIpcHandlers(getMainWindow: () => BrowserWindow | null) {
  await registerPluginHandlers();
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

  ipcMain.handle('get-temp-dir', async () => {
    const tempDir = path.join(app.getPath('userData'), 'temp-files');
    try {
      await fs.mkdir(tempDir, { recursive: true });
      return tempDir;
    } catch (error) {
      logger.error('Failed to create temp directory', error instanceof Error ? error : undefined, 'IPC', true);
      throw error;
    }
  });

  ipcMain.handle('create-temp-file', async (_, fileName: string, content: string) => {
    try {
      const tempDir = path.join(app.getPath('userData'), 'temp-files');
      await fs.mkdir(tempDir, { recursive: true });
      const filePath = path.join(tempDir, fileName);
      await fs.writeFile(filePath, content, 'utf-8');
      logger.info(`Temp file created: ${filePath}`, 'IPC');
      return filePath;
    } catch (error) {
      logger.error(`Failed to create temp file: ${fileName}`, error instanceof Error ? error : undefined, 'IPC', true);
      throw error;
    }
  });

  ipcMain.handle('delete-temp-file', async (_, filePath: string) => {
    try {
      await fs.unlink(filePath);
      logger.info(`Temp file deleted: ${filePath}`, 'IPC');
    } catch (error) {
      logger.error(`Failed to delete temp file: ${filePath}`, error instanceof Error ? error : undefined, 'IPC', false);
    }
  });

  ipcMain.handle('list-temp-files', async () => {
    try {
      const tempDir = path.join(app.getPath('userData'), 'temp-files');
      await fs.mkdir(tempDir, { recursive: true });
      const files = await fs.readdir(tempDir);
      return files.map(file => path.join(tempDir, file));
    } catch (error) {
      logger.error('Failed to list temp files', error instanceof Error ? error : undefined, 'IPC', false);
      return [];
    }
  });

  ipcMain.handle('show-unsaved-changes-dialog', async (_, fileName: string) => {
    const mainWindow = getMainWindow();
    const options = {
      type: 'warning' as const,
      buttons: ['Save', 'Don\'t Save', 'Cancel'],
      defaultId: 0,
      cancelId: 2,
      title: 'Unsaved Changes',
      message: `Do you want to save the changes you made to ${fileName}?`,
      detail: 'Your changes will be lost if you don\'t save them.',
    };

    const result = mainWindow
      ? await dialog.showMessageBox(mainWindow, options)
      : await dialog.showMessageBox(options);

    return result.response;
  });

  ipcMain.handle('save-session', async (_, sessionData: string) => {
    try {
      const userDataPath = app.getPath('userData');
      const sessionPath = path.join(userDataPath, 'session.json');
      await fs.writeFile(sessionPath, sessionData, 'utf-8');
      logger.info('Session saved', 'IPC');
    } catch (error) {
      logger.error('Failed to save session', error instanceof Error ? error : undefined, 'IPC', false);
    }
  });

  ipcMain.handle('get-session', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const sessionPath = path.join(userDataPath, 'session.json');
      const content = await fs.readFile(sessionPath, 'utf-8');
      logger.info('Session loaded', 'IPC');
      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('No session file found', 'IPC');
        return null;
      }
      logger.error('Failed to load session', error instanceof Error ? error : undefined, 'IPC', false);
      return null;
    }
  });

  ipcMain.handle('save-temp-files-metadata', async (_, metadataJson: string) => {
    try {
      const userDataPath = app.getPath('userData');
      const metadataPath = path.join(userDataPath, 'temp-files-metadata.json');
      await fs.writeFile(metadataPath, metadataJson, 'utf-8');
      logger.info('Temp files metadata saved', 'IPC');
    } catch (error) {
      logger.error('Failed to save temp files metadata', error instanceof Error ? error : undefined, 'IPC', false);
    }
  });

  ipcMain.handle('get-temp-files-metadata', async () => {
    try {
      const userDataPath = app.getPath('userData');
      const metadataPath = path.join(userDataPath, 'temp-files-metadata.json');
      const content = await fs.readFile(metadataPath, 'utf-8');
      logger.info('Temp files metadata loaded', 'IPC');
      return content;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('No temp files metadata found', 'IPC');
        return null;
      }
      logger.error('Failed to load temp files metadata', error instanceof Error ? error : undefined, 'IPC', false);
      return null;
    }
  });
}
