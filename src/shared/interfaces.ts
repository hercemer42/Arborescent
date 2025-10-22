import { ArboFile } from './types';

export interface StorageService {
  loadDocument(path: string): Promise<ArboFile>;
  saveDocument(path: string, data: ArboFile): Promise<void>;
  showOpenDialog(): Promise<string | null>;
  showSaveDialog(): Promise<string | null>;
  showUnsavedChangesDialog(fileName: string): Promise<number>;
  saveLastSession(filePath: string | null): void;
  getLastSession(): string | null;
  createTempFile(data: ArboFile): Promise<string>;
  deleteTempFile(filePath: string): Promise<void>;
  getTempFiles(): string[];
  listTempFiles(): Promise<string[]>;
  isTempFile(filePath: string): boolean;
}

export interface MenuService {
  onMenuNew(callback: () => void): void;
  onMenuOpen(callback: () => void): void;
  onMenuSave(callback: () => void): void;
  onMenuSaveAs(callback: () => void): void;
}

export interface ErrorService {
  onError(callback: (message: string) => void): void;
}
