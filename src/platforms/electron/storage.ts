import { ArboFile } from '../../shared/types';
import { StorageService } from '../../shared/interfaces';
import { getNextUntitledNumber } from '../../shared/utils/fileNaming';

export class ElectronStorageService implements StorageService {
  private readonly SESSION_KEY = 'arborescent_last_session';
  private readonly TEMP_FILES_KEY = 'arborescent_temp_files';
  private untitledCounter: number;

  constructor() {
    this.untitledCounter = getNextUntitledNumber(this.getTempFiles());
  }

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

  saveLastSession(filePath: string | null): void {
    if (filePath) {
      localStorage.setItem(this.SESSION_KEY, filePath);
    } else {
      localStorage.removeItem(this.SESSION_KEY);
    }
  }

  getLastSession(): string | null {
    return localStorage.getItem(this.SESSION_KEY);
  }

  async createTempFile(data: ArboFile): Promise<string> {
    const fileName = `untitled-${this.untitledCounter++}.json`;
    const content = JSON.stringify(data, null, 2);
    const filePath = await window.electron.createTempFile(fileName, content);

    const tempFiles = this.getTempFiles();
    tempFiles.push(filePath);
    localStorage.setItem(this.TEMP_FILES_KEY, JSON.stringify(tempFiles));

    return filePath;
  }

  async deleteTempFile(filePath: string): Promise<void> {
    await window.electron.deleteTempFile(filePath);

    const tempFiles = this.getTempFiles().filter(f => f !== filePath);
    localStorage.setItem(this.TEMP_FILES_KEY, JSON.stringify(tempFiles));
  }

  getTempFiles(): string[] {
    const stored = localStorage.getItem(this.TEMP_FILES_KEY);
    return stored ? JSON.parse(stored) : [];
  }

  async listTempFiles(): Promise<string[]> {
    return window.electron.listTempFiles();
  }

  isTempFile(filePath: string): boolean {
    return this.getTempFiles().includes(filePath);
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
      getTempDir: () => Promise<string>;
      createTempFile: (fileName: string, content: string) => Promise<string>;
      deleteTempFile: (filePath: string) => Promise<void>;
      listTempFiles: () => Promise<string[]>;
      onMenuNew: (callback: () => void) => void;
      onMenuOpen: (callback: () => void) => void;
      onMenuSave: (callback: () => void) => void;
      onMenuSaveAs: (callback: () => void) => void;
      onMainError: (callback: (message: string) => void) => void;
    };
  }
}
