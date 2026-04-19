import { StorageService, BrowserSession, BrowserTab } from '../../../../shared/interfaces';
import { logger } from '../../../services/logger';
import { DEFAULT_BROWSER_URL } from '../browserStore';
import type { FileBrowserState, BrowserState } from '../browserStore';
import { resolveToSourceFilePath } from '../../../utils/zoomPath';

export interface BrowserActions {
  setActiveFile: (filePath: string | null) => void;
  addTab: (url: string) => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTabTitle: (id: string, title: string) => void;
  updateTabUrl: (id: string, url: string) => void;
  togglePanelPosition: () => void;
  toggleBrowserVisibility: () => void;
  showBrowser: () => void;
  hideBrowser: () => void;
  setPanelHeight: (height: number) => void;
  setPanelWidth: (width: number) => void;
  closeFileBrowserTabs: (filePath: string) => void;
  restoreSession: () => Promise<void>;
}

type StoreGetter = () => BrowserState;
type StoreSetter = (partial: Partial<BrowserState> | ((state: BrowserState) => Partial<BrowserState>)) => void;

function getFileState(fileStates: Record<string, FileBrowserState>, filePath: string | null): FileBrowserState {
  if (!filePath) return { tabs: [], activeTabId: null };
  return fileStates[filePath] || { tabs: [], activeTabId: null };
}

function updateFileState(
  fileStates: Record<string, FileBrowserState>,
  filePath: string | null,
  update: Partial<FileBrowserState>,
): Record<string, FileBrowserState> {
  if (!filePath) return fileStates;
  const current = fileStates[filePath] || { tabs: [], activeTabId: null };
  return { ...fileStates, [filePath]: { ...current, ...update } };
}

export function createBrowserActions(get: StoreGetter, set: StoreSetter, storage: StorageService): BrowserActions {
  async function saveBrowserSession(state: BrowserState): Promise<void> {
    const session: BrowserSession = {
      tabs: state.tabs,
      activeTabId: state.activeTabId,
      fileStates: state.fileStates,
    };

    try {
      await storage.saveBrowserSession(session);
    } catch (error) {
      logger.error('Failed to save browser session', error as Error, 'BrowserActions');
    }
  }

  function setActiveFile(filePath: string | null): void {
    const resolved = resolveToSourceFilePath(filePath);
    const { fileStates, pendingLegacyTabs } = get();

    if (pendingLegacyTabs && resolved) {
      const migratedFileStates = updateFileState(fileStates, resolved, {
        tabs: pendingLegacyTabs.tabs,
        activeTabId: pendingLegacyTabs.activeTabId,
      });
      set({
        currentFilePath: resolved,
        tabs: pendingLegacyTabs.tabs,
        activeTabId: pendingLegacyTabs.activeTabId,
        fileStates: migratedFileStates,
        pendingLegacyTabs: undefined,
      });
      return;
    }

    const fileState = getFileState(fileStates, resolved);
    set({
      currentFilePath: resolved,
      tabs: fileState.tabs,
      activeTabId: fileState.activeTabId,
    });
  }

  function addTab(url: string): void {
    const { currentFilePath, fileStates } = get();
    if (!currentFilePath) return;

    const id = `browser-${Date.now()}`;
    const newTab: BrowserTab = { id, title: 'Loading...', url };
    const current = getFileState(fileStates, currentFilePath);
    const newTabs = [...current.tabs, newTab];
    const newFileStates = updateFileState(fileStates, currentFilePath, {
      tabs: newTabs,
      activeTabId: id,
    });

    const newState = {
      tabs: newTabs,
      activeTabId: id,
      isBrowserVisible: true,
      fileStates: newFileStates,
    };
    set((state: BrowserState) => {
      void saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function closeTab(id: string): void {
    const { currentFilePath, fileStates } = get();
    if (!currentFilePath) return;

    const current = getFileState(fileStates, currentFilePath);
    const newTabs = current.tabs.filter((tab) => tab.id !== id);
    const newActiveTabId = current.activeTabId === id
      ? (newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null)
      : current.activeTabId;
    const newFileStates = updateFileState(fileStates, currentFilePath, {
      tabs: newTabs,
      activeTabId: newActiveTabId,
    });

    const newState = { tabs: newTabs, activeTabId: newActiveTabId, fileStates: newFileStates };
    set((state: BrowserState) => {
      void saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function setActiveTab(id: string): void {
    const { currentFilePath, fileStates } = get();
    if (!currentFilePath) return;

    const newFileStates = updateFileState(fileStates, currentFilePath, { activeTabId: id });
    set((state: BrowserState) => {
      const newState = { activeTabId: id, fileStates: newFileStates };
      void saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function updateTabTitle(id: string, title: string): void {
    const { currentFilePath, fileStates } = get();
    if (!currentFilePath) return;

    const current = getFileState(fileStates, currentFilePath);
    const newTabs = current.tabs.map((tab) => (tab.id === id ? { ...tab, title } : tab));
    const newFileStates = updateFileState(fileStates, currentFilePath, { tabs: newTabs });

    set((state: BrowserState) => {
      const newState = { tabs: newTabs, fileStates: newFileStates };
      void saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function updateTabUrl(id: string, url: string): void {
    const { currentFilePath, fileStates } = get();
    if (!currentFilePath) return;

    const current = getFileState(fileStates, currentFilePath);
    const newTabs = current.tabs.map((tab) => (tab.id === id ? { ...tab, url } : tab));
    const newFileStates = updateFileState(fileStates, currentFilePath, { tabs: newTabs });

    set((state: BrowserState) => {
      const newState = { tabs: newTabs, fileStates: newFileStates };
      void saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function togglePanelPosition(): void {
    set((state: BrowserState) => {
      const newState = {
        panelPosition: (state.panelPosition === 'side' ? 'bottom' : 'side') as 'side' | 'bottom',
      };
      void saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function toggleBrowserVisibility(): void {
    set((state: BrowserState) => {
      const newVisibility = !state.isBrowserVisible;
      const newState = { isBrowserVisible: newVisibility };
      void saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function showBrowser(): void {
    set((state: BrowserState) => {
      const newState = { isBrowserVisible: true };
      void saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function hideBrowser(): void {
    set((state: BrowserState) => {
      const newState = { isBrowserVisible: false };
      void saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function setPanelHeight(height: number): void {
    set((state: BrowserState) => {
      const newState = { panelHeight: height };
      void saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function setPanelWidth(width: number): void {
    set((state: BrowserState) => {
      const newState = { panelWidth: width };
      void saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function closeFileBrowserTabs(filePath: string): void {
    const { fileStates } = get();
    const updated = { ...fileStates };
    delete updated[filePath];
    const { currentFilePath } = get();
    const currentState = currentFilePath === filePath
      ? { tabs: [] as BrowserTab[], activeTabId: null as string | null }
      : {};
    set({ fileStates: updated, ...currentState });
    void saveBrowserSession({ ...get(), fileStates: updated });
  }

  async function restoreSession(): Promise<void> {
    const session = await storage.getBrowserSession();

    if (session) {
      const fileStates = session.fileStates || {};
      const hasMigratedTabs = Object.keys(fileStates).length === 0 && session.tabs.length > 0;

      set({
        tabs: hasMigratedTabs ? session.tabs : [],
        activeTabId: hasMigratedTabs ? session.activeTabId : null,
        fileStates,
        pendingLegacyTabs: hasMigratedTabs ? { tabs: session.tabs, activeTabId: session.activeTabId } : undefined,
      });

      logger.info(`Restored browser session (${Object.keys(fileStates).length} file(s))`, 'BrowserActions');
    } else {
      const defaultTab: BrowserTab = {
        id: `browser-${Date.now()}`,
        title: 'Ecosia',
        url: DEFAULT_BROWSER_URL,
      };
      const defaultState = {
        tabs: [defaultTab],
        activeTabId: defaultTab.id,
      };

      set(defaultState);
      void saveBrowserSession(get());

      logger.info('Created default browser session', 'BrowserActions');
    }
  }

  return {
    setActiveFile,
    addTab,
    closeTab,
    setActiveTab,
    updateTabTitle,
    updateTabUrl,
    togglePanelPosition,
    toggleBrowserVisibility,
    showBrowser,
    hideBrowser,
    setPanelHeight,
    setPanelWidth,
    closeFileBrowserTabs,
    restoreSession,
  };
}
