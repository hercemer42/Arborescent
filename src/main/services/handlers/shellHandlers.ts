import { ipcMain, shell } from 'electron';

export function registerShellHandlers(): void {
  ipcMain.handle('open-external', async (_event, url: string) => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('Invalid URL protocol');
    }
    await shell.openExternal(url);
  });
}
