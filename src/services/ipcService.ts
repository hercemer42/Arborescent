import { ipcMain, dialog } from 'electron';
import { promises as fs } from 'node:fs';

export function registerIpcHandlers() {
  ipcMain.handle('read-file', async (_, filePath: string) => {
    return await fs.readFile(filePath, 'utf-8');
  });

  ipcMain.handle('write-file', async (_, filePath: string, content: string) => {
    await fs.writeFile(filePath, content, 'utf-8');
  });

  ipcMain.handle('show-open-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Arborescent Files', extensions: ['json'] }],
    });
    return result.canceled ? null : result.filePaths[0];
  });

  ipcMain.handle('show-save-dialog', async () => {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'Arborescent Files', extensions: ['json'] }],
    });
    return result.canceled ? null : result.filePath;
  });

  ipcMain.on('open-file', async (event) => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Arborescent Files', extensions: ['json'] }],
    });
    if (!result.canceled && result.filePaths[0]) {
      const content = await fs.readFile(result.filePaths[0], 'utf-8');
      event.reply('file-opened', { path: result.filePaths[0], content });
    }
  });

  ipcMain.on('save-file', async (event, data: { path?: string; content: string }) => {
    let filePath = data.path;
    if (!filePath) {
      const result = await dialog.showSaveDialog({
        filters: [{ name: 'Arborescent Files', extensions: ['json'] }],
      });
      if (result.canceled || !result.filePath) return;
      filePath = result.filePath;
    }
    await fs.writeFile(filePath, data.content, 'utf-8');
    event.reply('file-saved', { path: filePath });
  });

  ipcMain.on('save-file-as', async (event, data: { content: string }) => {
    const result = await dialog.showSaveDialog({
      filters: [{ name: 'Arborescent Files', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return;
    await fs.writeFile(result.filePath, data.content, 'utf-8');
    event.reply('file-saved', { path: result.filePath });
  });
}
