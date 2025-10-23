import { ArboFile } from './types';

export interface SessionState {
  openFiles: string[];
  activeFilePath: string | null;
}

export interface StorageService {
  loadDocument(path: string): Promise<ArboFile>;
  saveDocument(path: string, data: ArboFile): Promise<void>;
  showOpenDialog(): Promise<string | null>;
  showSaveDialog(): Promise<string | null>;
  showUnsavedChangesDialog(fileName: string): Promise<number>;
  saveSession(session: SessionState): Promise<void>;
  getSession(): Promise<SessionState | null>;
  createTempFile(data: ArboFile): Promise<string>;
  deleteTempFile(filePath: string): Promise<void>;
  getTempFiles(): Promise<string[]>;
  isTempFile(filePath: string): Promise<boolean>;
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
