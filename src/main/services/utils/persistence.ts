import { promises as fs } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { logger } from '../logger';

export async function getLastSavedDirectory(): Promise<string | undefined> {
  try {
    const userDataPath = app.getPath('userData');
    const lastDirPath = path.join(userDataPath, 'last-save-directory.txt');
    const lastDir = await fs.readFile(lastDirPath, 'utf-8');
    return lastDir.trim();
  } catch {
    return undefined;
  }
}

export async function saveLastUsedDirectory(filePath: string): Promise<void> {
  try {
    const directory = path.dirname(filePath);
    const userDataPath = app.getPath('userData');
    const lastDirPath = path.join(userDataPath, 'last-save-directory.txt');
    await fs.writeFile(lastDirPath, directory, 'utf-8');
    logger.info(`Saved last directory: ${directory}`, 'Persistence');
  } catch (error) {
    logger.error('Failed to save last directory', error instanceof Error ? error : undefined, 'Persistence', false);
  }
}

export async function saveJsonFile(fileName: string, content: string, logName: string): Promise<void> {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, fileName);
    await fs.writeFile(filePath, content, 'utf-8');
    logger.info(`${logName} saved`, 'Persistence');
  } catch (error) {
    logger.error(`Failed to save ${logName}`, error instanceof Error ? error : undefined, 'Persistence', false);
  }
}

export async function loadJsonFile(fileName: string, logName: string): Promise<string | null> {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, fileName);
    const content = await fs.readFile(filePath, 'utf-8');
    logger.info(`${logName} loaded`, 'Persistence');
    return content;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.info(`No ${logName.toLowerCase()} file found`, 'Persistence');
      return null;
    }
    logger.error(`Failed to load ${logName.toLowerCase()}`, error instanceof Error ? error : undefined, 'Persistence', false);
    return null;
  }
}
