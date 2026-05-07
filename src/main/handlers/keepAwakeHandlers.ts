import { ipcMain } from 'electron';
import { startKeepAwake, stopKeepAwake } from '../services/keepAwake';

export function registerKeepAwakeHandlers(): void {
  ipcMain.handle('keep-awake:start', () => {
    startKeepAwake();
  });

  ipcMain.handle('keep-awake:stop', () => {
    stopKeepAwake();
  });
}
