import { contextBridge, ipcRenderer } from 'electron';
import { pluginPreloadAPI } from '../../plugins/core/preload/preload';

contextBridge.exposeInMainWorld('electron', {
  readFile: (path: string) => ipcRenderer.invoke('read-file', path),
  writeFile: (path: string, content: string) =>
    ipcRenderer.invoke('write-file', path, content),
  showOpenDialog: () => ipcRenderer.invoke('show-open-dialog'),
  showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
  showUnsavedChangesDialog: (fileName: string) =>
    ipcRenderer.invoke('show-unsaved-changes-dialog', fileName),
  saveSession: (sessionData: string) =>
    ipcRenderer.invoke('save-session', sessionData),
  getSession: () => ipcRenderer.invoke('get-session'),
  getTempDir: () => ipcRenderer.invoke('get-temp-dir'),
  createTempFile: (fileName: string, content: string) =>
    ipcRenderer.invoke('create-temp-file', fileName, content),
  deleteTempFile: (filePath: string) =>
    ipcRenderer.invoke('delete-temp-file', filePath),
  listTempFiles: () => ipcRenderer.invoke('list-temp-files'),
  saveTempFilesMetadata: (metadata: string) =>
    ipcRenderer.invoke('save-temp-files-metadata', metadata),
  getTempFilesMetadata: () => ipcRenderer.invoke('get-temp-files-metadata'),
  setMenuNewHandler: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-new');
    ipcRenderer.on('menu-new', callback);
  },
  setMenuOpenHandler: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-open');
    ipcRenderer.on('menu-open', callback);
  },
  setMenuSaveHandler: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-save');
    ipcRenderer.on('menu-save', callback);
  },
  setMenuSaveAsHandler: (callback: () => void) => {
    ipcRenderer.removeAllListeners('menu-save-as');
    ipcRenderer.on('menu-save-as', callback);
  },
  setMainErrorHandler: (callback: (message: string) => void) => {
    ipcRenderer.removeAllListeners('main-error');
    ipcRenderer.on('main-error', (_event, message) => callback(message));
  },
  ...pluginPreloadAPI,
});
