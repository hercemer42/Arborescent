import { useTerminalStore } from '../../../store/terminal/terminalStore';
import { useBrowserStore, DEFAULT_BROWSER_URL } from '../../../store/browser/browserStore';
import { usePanelStore } from '../../../store/panel/panelStore';
import { useTerminalPanel } from '../../Terminal/hooks/useTerminalPanel';

/**
 * Hook to manage panel toggle actions for terminal and browser
 */
export function usePanelActions() {
  const activeContent = usePanelStore((state) => state.activeContent);
  const showTerminal = usePanelStore((state) => state.showTerminal);
  const showBrowser = usePanelStore((state) => state.showBrowser);
  const hidePanel = usePanelStore((state) => state.hidePanel);

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

  return {
    activeContent,
    handleTerminalToggle,
    handleBrowserToggle,
  };
}
