import { ArboFile } from './types';

export interface StorageService {
  loadDocument(path: string): Promise<ArboFile>;
  saveDocument(path: string, data: ArboFile): Promise<void>;
  showOpenDialog(): Promise<string | null>;
  showSaveDialog(): Promise<string | null>;
  saveLastSession(filePath: string | null): void;
  getLastSession(): string | null;
}

export interface MenuService {
  onMenuOpen(callback: () => void): void;
  onMenuSave(callback: () => void): void;
  onMenuSaveAs(callback: () => void): void;
}

export interface ErrorService {
  onError(callback: (message: string) => void): void;
}
