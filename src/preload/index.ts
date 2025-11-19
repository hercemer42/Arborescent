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
  saveBrowserSession: (sessionData: string) =>
    ipcRenderer.invoke('save-browser-session', sessionData),
  getBrowserSession: () => ipcRenderer.invoke('get-browser-session'),
  savePanelSession: (sessionData: string) =>
    ipcRenderer.invoke('save-panel-session', sessionData),
  getPanelSession: () => ipcRenderer.invoke('get-panel-session'),
  getTempDir: () => ipcRenderer.invoke('get-temp-dir'),
  createTempFile: (fileName: string, content: string) =>
    ipcRenderer.invoke('create-temp-file', fileName, content),
  deleteTempFile: (filePath: string) =>
    ipcRenderer.invoke('delete-temp-file', filePath),
  listTempFiles: () => ipcRenderer.invoke('list-temp-files'),
  saveTempFilesMetadata: (metadata: string) =>
    ipcRenderer.invoke('save-temp-files-metadata', metadata),
  getTempFilesMetadata: () => ipcRenderer.invoke('get-temp-files-metadata'),
  // Terminal IPC
  terminalCreate: (id: string, title: string, shellCommand?: string, shellArgs?: string[], cwd?: string) =>
    ipcRenderer.invoke('terminal:create', id, title, shellCommand, shellArgs, cwd),
  terminalWrite: (id: string, data: string) =>
    ipcRenderer.invoke('terminal:write', id, data),
  terminalResize: (id: string, cols: number, rows: number) =>
    ipcRenderer.invoke('terminal:resize', id, cols, rows),
  terminalDestroy: (id: string) =>
    ipcRenderer.invoke('terminal:destroy', id),
  onTerminalData: (id: string, callback: (data: string) => void) => {
    const channel = `terminal:data:${id}`;
    ipcRenderer.on(channel, (_event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners(channel);
  },
  onTerminalExit: (id: string, callback: (exitInfo: { exitCode: number; signal?: number }) => void) => {
    const channel = `terminal:exit:${id}`;
    ipcRenderer.on(channel, (_event, exitInfo) => callback(exitInfo));
    return () => ipcRenderer.removeAllListeners(channel);
  },
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
