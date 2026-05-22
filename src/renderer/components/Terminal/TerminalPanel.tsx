import { useSyncExternalStore } from 'react';
import { Anchor } from 'lucide-react';
import { useTerminalStore } from '../../store/terminal/terminalStore';
import { usePanelStore } from '../../store/panel/panelStore';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';
import { Terminal } from './Terminal';
import { Tab } from '../Tab';
import { selectAssociatedTerminalId } from '../../store/tree/selectors/associatedTerminalId';
import './TerminalPanel.css';
import { useTerminalPanel } from './hooks/useTerminalPanel';

export function TerminalPanel() {
  const { terminals, activeTerminalId, setActiveTerminal, togglePinnedToBottom, fileStates } = useTerminalStore();
  const panelPosition = usePanelStore((state) => state.panelPosition);
  const togglePanelPosition = usePanelStore((state) => state.togglePanelPosition);

  // Read activeNodeId via storeManager rather than useStore — TerminalPanel
  // renders outside the workspace's TreeStoreContext.Provider.
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const activeNodeId = useSyncExternalStore(
    (callback) => {
      if (!activeFilePath) return () => {};
      return storeManager.getStoreForFile(activeFilePath).subscribe(callback);
    },
    () => {
      if (!activeFilePath) return null;
      return storeManager.getStoreForFile(activeFilePath).getState().activeNodeId;
    },
    () => null
  );

  const { handleNewTerminal, handleCloseTerminal } = useTerminalPanel();

  const activeTerminal = terminals.find((t) => t.id === activeTerminalId);
  const isPinned = activeTerminal?.pinnedToBottom ?? false;

  const terminalOrigins: Record<string, string> = {};
  for (const term of terminals) {
    if (term.originNodeId) terminalOrigins[term.id] = term.originNodeId;
  }
  const associatedTerminalId = selectAssociatedTerminalId({ terminalOrigins }, activeNodeId);

  // Keep every file's xterm mounted so buffers survive file switches — unmounting would dispose them.
  const allTerminals = Object.values(fileStates ?? {}).flatMap((state) => state.terminals);

  return (
    <div className="terminal-panel">
      <div className="terminal-tab-bar">
        <div className="terminal-tabs-left">
          {terminals.map((term) => (
            <Tab
              key={term.id}
              displayName={term.title}
              isActive={activeTerminalId === term.id}
              isAssociated={associatedTerminalId === term.id}
              onClick={() => setActiveTerminal(term.id)}
              onClose={() => handleCloseTerminal(term.id)}
            />
          ))}
          <button onClick={handleNewTerminal} className="new-terminal-button" title="New Terminal">
            +
          </button>
        </div>
        <div className="terminal-tabs-right">
          {activeTerminalId && (
            <button
              onClick={() => togglePinnedToBottom(activeTerminalId)}
              className={`anchor-toggle-button ${isPinned ? 'anchored' : ''}`}
              title={isPinned ? 'Unanchor from bottom' : 'Anchor to bottom'}
            >
              <Anchor size={16} />
            </button>
          )}
          <button
            onClick={togglePanelPosition}
            className="toggle-panel-button"
            title={`Switch to ${panelPosition === 'side' ? 'bottom' : 'side'} panel`}
          >
            {panelPosition === 'side' ? '⬇' : '➡'}
          </button>
        </div>
      </div>

      <div className="terminal-content">
        {allTerminals.map((term) => (
          <div
            key={term.id}
            className="terminal-wrapper"
            style={{ display: activeTerminalId === term.id ? 'block' : 'none' }}
          >
            <Terminal id={term.id} pinnedToBottom={term.pinnedToBottom} />
          </div>
        ))}
      </div>
    </div>
  );
}
