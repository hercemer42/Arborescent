import { useSyncExternalStore, useCallback } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { usePanelStore } from '../../../store/panel/panelStore';
import { useTerminalStore } from '../../../store/terminal/terminalStore';
import { useBrowserStore, DEFAULT_BROWSER_URL } from '../../../store/browser/browserStore';
import { storeManager } from '../../../store/storeManager';

export function useViewMenuState() {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const activeContent = usePanelStore((state) => state.activeContent);

  const subscribe = useCallback((callback: () => void) => {
    if (!activeFilePath) return () => {};
    const store = storeManager.getStoreForFile(activeFilePath);
    return store.subscribe(callback);
  }, [activeFilePath]);

  const blueprintModeEnabled = useSyncExternalStore(
    subscribe,
    () => {
      if (!activeFilePath) return false;
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.getState().blueprintModeEnabled;
    },
    () => false
  );

  const summaryModeEnabled = useSyncExternalStore(
    subscribe,
    () => {
      if (!activeFilePath) return false;
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.getState().summaryModeEnabled;
    },
    () => false
  );

  const handleToggleBlueprintMode = useCallback(() => {
    if (!activeFilePath) return;
    const store = storeManager.getStoreForFile(activeFilePath);
    store.getState().actions.toggleBlueprintMode();
  }, [activeFilePath]);

  const handleToggleSummaryMode = useCallback(() => {
    if (!activeFilePath) return;
    const store = storeManager.getStoreForFile(activeFilePath);
    store.getState().actions.toggleSummaryMode();
  }, [activeFilePath]);

  const handleToggleTerminal = useCallback(async () => {
    const panelStore = usePanelStore.getState();
    if (panelStore.activeContent === 'terminal') {
      panelStore.hidePanel();
    } else {
      const terminalStore = useTerminalStore.getState();
      if (terminalStore.terminals.length === 0) {
        await terminalStore.createNewTerminal('Terminal');
      }
      panelStore.showTerminal();
    }
  }, []);

  const handleToggleBrowser = useCallback(() => {
    const panelStore = usePanelStore.getState();
    if (panelStore.activeContent === 'browser') {
      panelStore.hidePanel();
    } else {
      const browserStore = useBrowserStore.getState();
      if (browserStore.tabs.length === 0) {
        browserStore.actions.addTab(DEFAULT_BROWSER_URL);
      }
      panelStore.showBrowser();
    }
  }, []);

  const handleToggleFeedback = useCallback(() => {
    const panelStore = usePanelStore.getState();
    if (panelStore.activeContent === 'feedback') {
      panelStore.hidePanel();
    } else {
      panelStore.showFeedback();
    }
  }, []);

  return {
    hasActiveFile: !!activeFilePath,
    blueprintModeEnabled,
    summaryModeEnabled,
    terminalOpen: activeContent === 'terminal',
    browserOpen: activeContent === 'browser',
    feedbackOpen: activeContent === 'feedback',
    handleToggleBlueprintMode,
    handleToggleSummaryMode,
    handleToggleTerminal,
    handleToggleBrowser,
    handleToggleFeedback,
  };
}
