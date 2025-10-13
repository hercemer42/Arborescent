import { ArboFile } from '../../shared/types';
import { StorageService } from '../../shared/interfaces';

export class ElectronStorageService implements StorageService {
  private readonly SESSION_KEY = 'arborescent_last_session';

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
}

declare global {
  interface Window {
    electron: {
      readFile: (path: string) => Promise<string>;
      writeFile: (path: string, content: string) => Promise<void>;
      showOpenDialog: () => Promise<string | null>;
      showSaveDialog: () => Promise<string | null>;
      onMenuOpen: (callback: () => void) => void;
      onMenuSave: (callback: () => void) => void;
      onMenuSaveAs: (callback: () => void) => void;
      onMainError: (callback: (message: string) => void) => void;
    };
  }
}
