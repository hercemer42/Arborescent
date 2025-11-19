import { useTerminalStore } from '../../store/terminal/terminalStore';
import { useBrowserStore, DEFAULT_BROWSER_URL } from '../../store/browser/browserStore';
import { useTerminalPanel } from '../Terminal/hooks/useTerminalPanel';
import './PanelActions.css';

export function PanelActions() {
  const { isTerminalVisible, terminals, showTerminal, toggleTerminalVisibility } = useTerminalStore();
  const { isBrowserVisible, actions: browserActions } = useBrowserStore();
  const { handleNewTerminal } = useTerminalPanel();

  const handleTerminalToggle = async () => {
    if (isTerminalVisible) {
      toggleTerminalVisibility();
    } else {
      // Create a new terminal if none exist
      if (terminals.length === 0) {
        await handleNewTerminal();
      } else {
        showTerminal();
      }
    }
  };

  const handleBrowserToggle = () => {
    if (isBrowserVisible) {
      browserActions.toggleBrowserVisibility();
    } else {
      // Create a new browser tab if none exist
      const tabs = useBrowserStore.getState().tabs;
      if (tabs.length === 0) {
        browserActions.addTab(DEFAULT_BROWSER_URL);
      } else {
        browserActions.showBrowser();
      }
    }
  };

  return (
    <div className="panel-actions">
      <button
        className="panel-action-button"
        onClick={handleTerminalToggle}
        title={isTerminalVisible ? 'Hide Terminal (Ctrl+`)' : 'Show Terminal (Ctrl+`)'}
      >
        {'>_'}
      </button>
      <button
        className="panel-action-button"
        onClick={handleBrowserToggle}
        title={isBrowserVisible ? 'Hide Browser' : 'Show Browser'}
      >
        {'🌐'}
      </button>
    </div>
  );
}
