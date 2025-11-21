import { ipcMain } from 'electron';
import { promises as fs } from 'node:fs';
import { logger } from '../logger';

/**
 * Register file-related IPC handlers
 */
export function registerFileHandlers(): void {
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
}
