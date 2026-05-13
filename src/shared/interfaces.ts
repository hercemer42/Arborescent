import { ArboFile } from './types';

export interface SessionState {
  openFiles: string[];
  activeFilePath: string | null;
}

export type Theme = 'light' | 'dark';

export type HotkeyMap = Record<string, Record<string, string>>;

export interface UserPreferences {
  theme: Theme;
  hotkeys?: HotkeyMap;
  hasSeenWorkflowDeclarationToast?: boolean;
  hasReceivedHookEvent?: boolean;
  hasLaunchedWorkflow?: boolean;
  stepTimeoutMinutes?: number;
  desktopNotifications?: boolean;
  notificationSounds?: boolean;
}

export interface BrowserTab {
  id: string;
  title: string;
  url: string;
}

export interface BrowserSession {
  tabs: BrowserTab[];
  activeTabId: string | null;
  fileStates?: Record<string, { tabs: BrowserTab[]; activeTabId: string | null }>;
}

export interface TerminalSessionEntry {
  title: string;
  cwd: string;
  originNodeId?: string;
}

export interface TerminalSession {
  fileStates: Record<string, { terminals: TerminalSessionEntry[]; activeTerminalIndex: number | null }>;
}

export interface PanelSession {
  panelPosition: 'side' | 'bottom';
  panelHeight: number;
  panelWidth: number;
  activeContent: 'terminal' | 'browser' | 'feedback' | null;
  fileStates?: Record<string, { activeContent: 'terminal' | 'browser' | 'feedback' | null; previousContent: 'terminal' | 'browser' | 'feedback' | null }>;
}

export interface StorageService {
  loadDocument(path: string): Promise<ArboFile>;
  saveDocument(path: string, data: ArboFile): Promise<void>;
  showOpenDialog(): Promise<string | null>;
  showSaveDialog(defaultPath?: string): Promise<string | null>;
  showUnsavedChangesDialog(fileName: string): Promise<number>;
  showRunningWorkflowDialog(fileName: string): Promise<boolean>;
  showActiveSessionDialog(fileName: string): Promise<boolean>;
  saveSession(session: SessionState): Promise<void>;
  getSession(): Promise<SessionState | null>;
  createTempFile(data: ArboFile): Promise<string>;
  deleteTempFile(filePath: string): Promise<void>;
  getTempFiles(): Promise<string[]>;
  isTempFile(filePath: string): Promise<boolean>;
  saveBrowserSession(session: BrowserSession): Promise<void>;
  getBrowserSession(): Promise<BrowserSession | null>;
  saveTerminalSession(session: TerminalSession): Promise<void>;
  getTerminalSession(): Promise<TerminalSession | null>;
  savePanelSession(session: PanelSession): Promise<void>;
  getPanelSession(): Promise<PanelSession | null>;
  savePreferences(preferences: UserPreferences): Promise<void>;
  getPreferences(): Promise<UserPreferences | null>;
}
