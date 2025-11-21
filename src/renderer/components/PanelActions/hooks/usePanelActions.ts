import { useSyncExternalStore } from 'react';
import { useTerminalStore } from '../../../store/terminal/terminalStore';
import { useBrowserStore, DEFAULT_BROWSER_URL } from '../../../store/browser/browserStore';
import { usePanelStore } from '../../../store/panel/panelStore';
import { useTerminalPanel } from '../../Terminal/hooks/useTerminalPanel';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';

/**
 * Hook to manage panel toggle actions for terminal, browser, and review
 */
export function usePanelActions() {
  const activeContent = usePanelStore((state) => state.activeContent);
  const showTerminal = usePanelStore((state) => state.showTerminal);
  const showBrowser = usePanelStore((state) => state.showBrowser);
  const showReview = usePanelStore((state) => state.showReview);
  const hidePanel = usePanelStore((state) => state.hidePanel);

  // Get reviewingNodeId for the active file using storeManager (not useStore)
  // This allows the component to work outside TreeStoreProvider context
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const reviewingNodeId = useSyncExternalStore(
    (callback) => {
      if (!activeFilePath) return () => {};
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.subscribe(callback);
    },
    () => {
      if (!activeFilePath) return null;
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.getState().reviewingNodeId;
    },
    () => null
  );

  const terminals = useTerminalStore((state) => state.terminals);
  const tabs = useBrowserStore((state) => state.tabs);
  const addTab = useBrowserStore((state) => state.actions.addTab);
  const { handleNewTerminal } = useTerminalPanel();

  const handleTerminalToggle = async () => {
    if (activeContent === 'terminal') {
      // Hide panel if terminal is already showing
      hidePanel();
    } else {
      // Create a new terminal if none exist
      if (terminals.length === 0) {
        await handleNewTerminal();
      }
      // Show terminal in panel
      showTerminal();
    }
  };

  const handleBrowserToggle = () => {
    if (activeContent === 'browser') {
      // Hide panel if browser is already showing
      hidePanel();
    } else {
      // Create a new browser tab if none exist
      if (tabs.length === 0) {
        addTab(DEFAULT_BROWSER_URL);
      }
      // Show browser in panel
      showBrowser();
    }
  };

  const handleReviewShow = () => {
    // Only show review panel if there's an active review
    // The panel can only be hidden by accepting or canceling the review
    if (reviewingNodeId) {
      showReview();
    }
  };

  return {
    activeContent,
    reviewingNodeId,
    handleTerminalToggle,
    handleBrowserToggle,
    handleReviewShow,
  };
}
