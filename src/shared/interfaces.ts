import { ArboFile } from './types';

export interface SessionState {
  openFiles: string[];
  activeFilePath: string | null;
}

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
}

export interface BrowserSession {
  tabs: BrowserTab[];
  activeTabId: string | null;
}

export interface PanelSession {
  panelPosition: 'side' | 'bottom';
  panelHeight: number;
  panelWidth: number;
  activeContent: 'terminal' | 'browser' | null;
}

export interface StorageService {
  loadDocument(path: string): Promise<ArboFile>;
  saveDocument(path: string, data: ArboFile): Promise<void>;
  showOpenDialog(): Promise<string | null>;
  showSaveDialog(defaultPath?: string): Promise<string | null>;
  showUnsavedChangesDialog(fileName: string): Promise<number>;
  saveSession(session: SessionState): Promise<void>;
  getSession(): Promise<SessionState | null>;
  createTempFile(data: ArboFile): Promise<string>;
  deleteTempFile(filePath: string): Promise<void>;
  getTempFiles(): Promise<string[]>;
  isTempFile(filePath: string): Promise<boolean>;
  saveBrowserSession(session: BrowserSession): Promise<void>;
  getBrowserSession(): Promise<BrowserSession | null>;
  savePanelSession(session: PanelSession): Promise<void>;
  getPanelSession(): Promise<PanelSession | null>;
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
