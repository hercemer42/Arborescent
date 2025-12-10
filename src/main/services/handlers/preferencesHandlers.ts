import { ipcMain } from 'electron';
import { saveJsonFile, loadJsonFile } from '../utils/persistence';

export function registerPreferencesHandlers(): void {
  ipcMain.handle('save-preferences', async (_, preferencesData: string) => {
    await saveJsonFile('preferences.json', preferencesData, 'Preferences');
  });

  ipcMain.handle('get-preferences', async () => {
    return await loadJsonFile('preferences.json', 'Preferences');
  });
}
