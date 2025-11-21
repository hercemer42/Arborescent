import { ipcMain, dialog, BrowserWindow } from 'electron';
import { logger } from '../logger';
import { getLastSavedDirectory, saveLastUsedDirectory } from '../utils/persistence';

/**
 * Register dialog-related IPC handlers
 */
export function registerDialogHandlers(getMainWindow: () => BrowserWindow | null): void {
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
}
