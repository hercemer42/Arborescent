import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('write-file', path, content),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
  onMenuOpen: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-open');
    ipcRenderer.on('menu-open', callback);
  },
  onMenuSave: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-save');
    ipcRenderer.on('menu-save', callback);
  },
  onMenuSaveAs: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-save-as');
    ipcRenderer.on('menu-save-as', callback);
  },
  onMainError: (callback: (message: string) => void) => {
    ipcRenderer.removeAllListeners('main-error');
    ipcRenderer.on('main-error', (_event, message) => callback(message));
  },
});
