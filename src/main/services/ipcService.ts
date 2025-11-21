import { ipcMain, dialog, BrowserWindow, app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { logger } from './logger';
import { registerPluginHandlers } from '../../../plugins/core/main/registerHandlers';
import { clipboardMonitor } from './clipboardMonitor';

// Helper: Get last saved directory
async function getLastSavedDirectory(): Promise<string | undefined> {
  try {
    const userDataPath = app.getPath('userData');
    const lastDirPath = path.join(userDataPath, 'last-save-directory.txt');
    const lastDir = await fs.readFile(lastDirPath, 'utf-8');
    return lastDir.trim();
  } catch {
    return undefined;
  }
}

// Helper: Save directory for next time
async function saveLastUsedDirectory(filePath: string): Promise<void> {
  try {
    const directory = path.dirname(filePath);
    const userDataPath = app.getPath('userData');
    const lastDirPath = path.join(userDataPath, 'last-save-directory.txt');
    await fs.writeFile(lastDirPath, directory, 'utf-8');
    logger.info(`Saved last directory: ${directory}`, 'IPC');
  } catch (error) {
    logger.error('Failed to save last directory', error instanceof Error ? error : undefined, 'IPC', false);
  }
}

// Helper: Save JSON file to userData
async function saveJsonFile(fileName: string, content: string, logName: string): Promise<void> {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, fileName);
    await fs.writeFile(filePath, content, 'utf-8');
    logger.info(`${logName} saved`, 'IPC');
  } catch (error) {
    logger.error(`Failed to save ${logName}`, error instanceof Error ? error : undefined, 'IPC', false);
  }
}

// Helper: Load JSON file from userData
async function loadJsonFile(fileName: string, logName: string): Promise<string | null> {
  try {
    const userDataPath = app.getPath('userData');
    const filePath = path.join(userDataPath, fileName);
    const content = await fs.readFile(filePath, 'utf-8');
    logger.info(`${logName} loaded`, 'IPC');
    return content;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.info(`No ${logName.toLowerCase()} file found`, 'IPC');
      return null;
    }
    logger.error(`Failed to load ${logName.toLowerCase()}`, error instanceof Error ? error : undefined, 'IPC', false);
    return null;
  }
}

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

    const defaultPath = await getLastSavedDirectory();

    const options = {
      defaultPath,
      properties: ['openFile' as const],
      filters: [{ name: 'Arborescent Files', extensions: ['arbo'] }],
    };

    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);

    logger.info(`Dialog result received, canceled: ${result.canceled}, path: ${result.filePaths[0] || 'none'}`, 'IPC');

    if (!result.canceled && result.filePaths[0]) {
      await saveLastUsedDirectory(result.filePaths[0]);
    }

    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('show-save-dialog', async (_event, providedDefaultPath?: string) => {
    const mainWindow = getMainWindow();

    // Use provided default path (e.g., current file's directory), or fall back to last saved directory
    const defaultPath = providedDefaultPath || await getLastSavedDirectory();

    const options = {
      defaultPath,
      filters: [{ name: 'Arborescent Files', extensions: ['arbo'] }],
    };

    const result = mainWindow
      ? await dialog.showSaveDialog(mainWindow, options)
      : await dialog.showSaveDialog(options);

    if (result.canceled || !result.filePath || result.filePath === '') {
      return null;
    }

    // Ensure .arbo extension is always present (cross-platform consistency)
    let filePath = result.filePath;
    if (!filePath.endsWith('.arbo')) {
      filePath = `${filePath}.arbo`;
    }

    await saveLastUsedDirectory(filePath);

    return filePath;
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
    await saveJsonFile('session.json', sessionData, 'Session');
  });

  ipcMain.handle('get-session', async () => {
    return await loadJsonFile('session.json', 'Session');
  });

  ipcMain.handle('save-browser-session', async (_, sessionData: string) => {
    await saveJsonFile('browser-session.json', sessionData, 'Browser session');
  });

  ipcMain.handle('get-browser-session', async () => {
    return await loadJsonFile('browser-session.json', 'Browser session');
  });

  ipcMain.handle('save-panel-session', async (_, sessionData: string) => {
    await saveJsonFile('panel-session.json', sessionData, 'Panel session');
  });

  ipcMain.handle('get-panel-session', async () => {
    return await loadJsonFile('panel-session.json', 'Panel session');
  });

  ipcMain.handle('save-temp-files-metadata', async (_, metadataJson: string) => {
    await saveJsonFile('temp-files-metadata.json', metadataJson, 'Temp files metadata');
  });

  ipcMain.handle('get-temp-files-metadata', async () => {
    return await loadJsonFile('temp-files-metadata.json', 'Temp files metadata');
  });

  // Clipboard monitoring for review feature
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
