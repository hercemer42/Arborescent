import { useSyncExternalStore } from 'react';
import { useTerminalStore } from '../../../store/terminal/terminalStore';
import { useBrowserStore, DEFAULT_BROWSER_URL } from '../../../store/browser/browserStore';
import { usePanelStore } from '../../../store/panel/panelStore';
import { useTerminalPanel } from '../../Terminal/hooks/useTerminalPanel';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';

/**
 * Hook to manage panel toggle actions for terminal, browser, and feedback
 */
export function usePanelActions() {
  const activeContent = usePanelStore((state) => state.activeContent);
  const showTerminal = usePanelStore((state) => state.showTerminal);
  const showBrowser = usePanelStore((state) => state.showBrowser);
  const showFeedback = usePanelStore((state) => state.showFeedback);
  const hidePanel = usePanelStore((state) => state.hidePanel);

  // Get collaboratingNodeId for the active file using storeManager (not useStore)
  // This allows the component to work outside TreeStoreProvider context
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const collaboratingNodeId = useSyncExternalStore(
    (callback) => {
      if (!activeFilePath) return () => {};
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.subscribe(callback);
    },
    () => {
      if (!activeFilePath) return null;
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.getState().collaboratingNodeId;
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

  const handleFeedbackShow = () => {
    // Only show feedback panel if there's an active collaboration
    // The panel can only be hidden by accepting or canceling the collaboration
    if (collaboratingNodeId) {
      showFeedback();
    }
  };

  return {
    activeContent,
    collaboratingNodeId,
    handleTerminalToggle,
    handleBrowserToggle,
    handleFeedbackShow,
  };
}
