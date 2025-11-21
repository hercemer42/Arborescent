import { ipcMain, app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { logger } from '../logger';

/**
 * Register temporary file management IPC handlers
 */
export function registerTempFileHandlers(): void {
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

  // Review temp file handlers
  ipcMain.handle('save-review-temp-file', async (_, fileName: string, content: string) => {
    try {
      const tempDir = path.join(app.getPath('userData'), 'temp-files');
      await fs.mkdir(tempDir, { recursive: true });
      const filePath = path.join(tempDir, fileName);
      await fs.writeFile(filePath, content, 'utf-8');
      logger.info(`Review temp file saved: ${filePath}`, 'IPC');
      return filePath;
    } catch (error) {
      logger.error(`Failed to save review temp file: ${fileName}`, error instanceof Error ? error : undefined, 'IPC', true);
      throw error;
    }
  });

  ipcMain.handle('load-review-temp-file', async (_, filePath: string) => {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      logger.info(`Review temp file loaded: ${filePath}`, 'IPC');
      return content;
    } catch (error) {
      logger.error(`Failed to load review temp file: ${filePath}`, error instanceof Error ? error : undefined, 'IPC', false);
      return null;
    }
  });

  ipcMain.handle('delete-review-temp-file', async (_, filePath: string) => {
    try {
      await fs.unlink(filePath);
      logger.info(`Review temp file deleted: ${filePath}`, 'IPC');
    } catch (error) {
      logger.error(`Failed to delete review temp file: ${filePath}`, error instanceof Error ? error : undefined, 'IPC', false);
    }
  });
}
