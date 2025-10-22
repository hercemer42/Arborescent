import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('write-file', path, content),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
  showUnsavedChangesDialog: (fileName: string) =>
    ipcRenderer.invoke('show-unsaved-changes-dialog', fileName),
  getTempDir: () => ipcRenderer.invoke('get-temp-dir'),
  createTempFile: (fileName: string, content: string) =>
    ipcRenderer.invoke('create-temp-file', fileName, content),
  deleteTempFile: (filePath: string) =>
    ipcRenderer.invoke('delete-temp-file', filePath),
  listTempFiles: () => ipcRenderer.invoke('list-temp-files'),
  onMenuNew: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-new');
    ipcRenderer.on('menu-new', callback);
  },
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
