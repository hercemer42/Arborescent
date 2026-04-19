import { ipcMain, app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { logger } from '../services/logger';
import { assertBareFileName, assertInsideDir, assertNonEmptyPath } from './pathValidation';

function tempDir(): string {
  return path.join(app.getPath('userData'), 'temp-files');
}

export function registerTempFileHandlers(): void {
  ipcMain.handle('get-temp-dir', async () => {
    const dir = tempDir();
    try {
      await fs.mkdir(dir, { recursive: true });
      return dir;
    } catch (error) {
      logger.error('Failed to create temp directory', error instanceof Error ? error : undefined, 'IPC', true);
      throw error;
    }
  });

  ipcMain.handle('create-temp-file', async (_, fileName: string, content: string) => {
    assertBareFileName(fileName, 'create-temp-file');
    try {
      const dir = tempDir();
      await fs.mkdir(dir, { recursive: true });
      const filePath = path.join(dir, fileName);
      await fs.writeFile(filePath, content, 'utf-8');
      logger.info(`Temp file created: ${filePath}`, 'IPC');
      return filePath;
    } catch (error) {
      logger.error(`Failed to create temp file: ${fileName}`, error instanceof Error ? error : undefined, 'IPC', true);
      throw error;
    }
  });

  ipcMain.handle('delete-temp-file', async (_, filePath: string) => {
    assertNonEmptyPath(filePath, 'delete-temp-file');
    try {
      assertInsideDir(filePath, tempDir(), 'delete-temp-file');
      await fs.unlink(filePath);
      logger.info(`Temp file deleted: ${filePath}`, 'IPC');
    } catch (error) {
      logger.error(`Failed to delete temp file: ${filePath}`, error instanceof Error ? error : undefined, 'IPC', false);
    }
  });

  ipcMain.handle('list-temp-files', async () => {
    try {
      const dir = tempDir();
      await fs.mkdir(dir, { recursive: true });
      const files = await fs.readdir(dir);
      return files.map(file => path.join(dir, file));
    } catch (error) {
      logger.error('Failed to list temp files', error instanceof Error ? error : undefined, 'IPC', false);
      return [];
    }
  });

  ipcMain.handle('read-temp-file', async (_, filePath: string) => {
    assertNonEmptyPath(filePath, 'read-temp-file');
    try {
      assertInsideDir(filePath, tempDir(), 'read-temp-file');
      const content = await fs.readFile(filePath, 'utf-8');
      logger.info(`Temp file read: ${filePath}`, 'IPC');
      return content;
    } catch (error) {
      logger.error(`Failed to read temp file: ${filePath}`, error instanceof Error ? error : undefined, 'IPC', false);
      return null;
    }
  });

  ipcMain.handle('is-temp-file', async (_, filePath: string) => {
    if (typeof filePath !== 'string' || filePath.length === 0) return false;
    const dir = tempDir();
    const resolved = path.resolve(filePath);
    const base = path.resolve(dir);
    const baseWithSep = base.endsWith(path.sep) ? base : base + path.sep;
    return resolved === base || resolved.startsWith(baseWithSep);
  });
}
