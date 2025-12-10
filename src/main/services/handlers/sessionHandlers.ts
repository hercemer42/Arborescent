import { ipcMain } from 'electron';
import { saveJsonFile, loadJsonFile } from '../utils/persistence';

export function registerSessionHandlers(): void {
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
}
