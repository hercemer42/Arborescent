import { ArboFile } from '../../../shared/types';
import { StorageService as IStorageService, SessionState } from '../../../shared/interfaces';
import { getNextUntitledNumber } from '../../../shared/utils/fileNaming';
import type { PluginPreloadAPI } from '../../../../plugins/core/preload/preload';

export class Storage implements IStorageService {
  async loadDocument(filePath: string): Promise<ArboFile> {
    const content = await window.electron.readFile(filePath);
    const data = JSON.parse(content) as ArboFile;

    if (data.format !== 'Arborescent') {
      throw new Error('Invalid file format');
    }

    return data;
  }

  async saveDocument(filePath: string, data: ArboFile): Promise<void> {
    const json = JSON.stringify(data, null, 2);
    await window.electron.writeFile(filePath, json);
  }

  async showOpenDialog(): Promise<string | null> {
    return window.electron.showOpenDialog();
  }

  async showSaveDialog(): Promise<string | null> {
    return window.electron.showSaveDialog();
  }

  async saveSession(session: SessionState): Promise<void> {
    const sessionData = JSON.stringify(session, null, 2);
    await window.electron.saveSession(sessionData);
  }

  async getSession(): Promise<SessionState | null> {
    const sessionData = await window.electron.getSession();
    if (!sessionData) return null;
    try {
      return JSON.parse(sessionData) as SessionState;
    } catch {
      return null;
    }
  }

  async createTempFile(data: ArboFile): Promise<string> {
    const tempFiles = await this.getTempFiles();
    const nextNumber = getNextUntitledNumber(tempFiles);
    const fileName = `untitled-${nextNumber}.json`;
    const content = JSON.stringify(data, null, 2);
    const filePath = await window.electron.createTempFile(fileName, content);

    tempFiles.push(filePath);
    await window.electron.saveTempFilesMetadata(JSON.stringify(tempFiles));

    return filePath;
  }

  async deleteTempFile(filePath: string): Promise<void> {
    await window.electron.deleteTempFile(filePath);

    const tempFiles = await this.getTempFiles();
    const updatedFiles = tempFiles.filter(f => f !== filePath);
    await window.electron.saveTempFilesMetadata(JSON.stringify(updatedFiles));
  }

  async getTempFiles(): Promise<string[]> {
    const metadata = await window.electron.getTempFilesMetadata();
    if (!metadata) return [];
    try {
      return JSON.parse(metadata) as string[];
    } catch {
      return [];
    }
  }

  async isTempFile(filePath: string): Promise<boolean> {
    const tempFiles = await this.getTempFiles();
    return tempFiles.includes(filePath);
  }

  async showUnsavedChangesDialog(fileName: string): Promise<number> {
    return window.electron.showUnsavedChangesDialog(fileName);
  }
}

declare global {
  interface Window {
    electron: {
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<void>;
      showOpenDialog: () => Promise<string | null>;
      showSaveDialog: () => Promise<string | null>;
      showUnsavedChangesDialog: (fileName: string) => Promise<number>;
      saveSession: (sessionData: string) => Promise<void>;
      getSession: () => Promise<string | null>;
      getTempDir: () => Promise<string>;
      createTempFile: (fileName: string, content: string) => Promise<string>;
      deleteTempFile: (filePath: string) => Promise<void>;
      listTempFiles: () => Promise<string[]>;
      saveTempFilesMetadata: (metadata: string) => Promise<void>;
      getTempFilesMetadata: () => Promise<string | null>;
      setMenuNewHandler: (callback: () => void) => void;
      setMenuOpenHandler: (callback: () => void) => void;
      setMenuSaveHandler: (callback: () => void) => void;
      setMenuSaveAsHandler: (callback: () => void) => void;
      setMainErrorHandler: (callback: (message: string) => void) => void;
    } & PluginPreloadAPI;
  }
}
