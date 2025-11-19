import { StorageService, BrowserSession, BrowserTab } from '../../../../shared/interfaces';
import { logger } from '../../../services/logger';
import { DEFAULT_BROWSER_URL } from '../browserStore';

interface BrowserState {
  tabs: BrowserTab[];
  activeTabId: string | null;
  panelPosition: 'side' | 'bottom';
  isBrowserVisible: boolean;
  panelHeight: number;
  panelWidth: number;
}

export interface BrowserActions {
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
  restoreSession: () => Promise<void>;
}

type StoreGetter = () => BrowserState;
type StoreSetter = (partial: Partial<BrowserState> | ((state: BrowserState) => Partial<BrowserState>)) => void;

export function createBrowserActions(get: StoreGetter, set: StoreSetter, storage: StorageService): BrowserActions {
  async function saveBrowserSession(state: BrowserState): Promise<void> {
    const session: BrowserSession = {
      tabs: state.tabs,
      activeTabId: state.activeTabId,
    };

    try {
      await storage.saveBrowserSession(session);
    } catch (error) {
      logger.error('Failed to save browser session', error as Error, 'BrowserActions');
    }
  }
  function addTab(url: string): void {
    const id = `browser-${Date.now()}`;
    const newTab: BrowserTab = {
      id,
      title: 'Loading...',
      url,
    };

    set((state: BrowserState) => {
      const newState = {
        tabs: [...state.tabs, newTab],
        activeTabId: id,
        isBrowserVisible: true,
      };
      saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function closeTab(id: string): void {
    set((state: BrowserState) => {
      const newTabs = state.tabs.filter((tab) => tab.id !== id);
      let newActiveTabId = state.activeTabId;

      if (state.activeTabId === id) {
        newActiveTabId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null;
      }

      const newState = {
        tabs: newTabs,
        activeTabId: newActiveTabId,
      };
      saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function setActiveTab(id: string): void {
    set((state: BrowserState) => {
      const newState = { activeTabId: id };
      saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function updateTabTitle(id: string, title: string): void {
    set((state: BrowserState) => {
      const newState = {
        tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, title } : tab)),
      };
      saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function updateTabUrl(id: string, url: string): void {
    set((state: BrowserState) => {
      const newState = {
        tabs: state.tabs.map((tab) => (tab.id === id ? { ...tab, url } : tab)),
      };
      saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function togglePanelPosition(): void {
    set((state: BrowserState) => {
      const newState = {
        panelPosition: (state.panelPosition === 'side' ? 'bottom' : 'side') as 'side' | 'bottom',
      };
      saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function toggleBrowserVisibility(): void {
    set((state: BrowserState) => {
      const newVisibility = !state.isBrowserVisible;
      const newState = { isBrowserVisible: newVisibility };
      saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function showBrowser(): void {
    set((state: BrowserState) => {
      const newState = { isBrowserVisible: true };
      saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function hideBrowser(): void {
    set((state: BrowserState) => {
      const newState = { isBrowserVisible: false };
      saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function setPanelHeight(height: number): void {
    set((state: BrowserState) => {
      const newState = { panelHeight: height };
      saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  function setPanelWidth(width: number): void {
    set((state: BrowserState) => {
      const newState = { panelWidth: width };
      saveBrowserSession({ ...state, ...newState });
      return newState;
    });
  }

  async function restoreSession(): Promise<void> {
    const session = await storage.getBrowserSession();

    if (session) {
      set({
        tabs: session.tabs,
        activeTabId: session.activeTabId,
      });

      logger.info(`Restored ${session.tabs.length} browser tab(s)`, 'BrowserActions');
    } else {
      // No session file exists - create default session with one tab
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
      saveBrowserSession(get());

      logger.info('Created default browser session', 'BrowserActions');
    }
  }

  return {
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
    restoreSession,
  };
}
