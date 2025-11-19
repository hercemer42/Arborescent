import { useTerminalStore } from '../../store/terminal/terminalStore';
import { Terminal } from './Terminal';
import { Tab } from '../Tab';
import './TerminalPanel.css';
import { useTerminalPanel } from './hooks/useTerminalPanel';

export function TerminalPanel() {
  const { terminals, activeTerminalId, panelPosition, setActiveTerminal, togglePanelPosition } =
    useTerminalStore();
  const { handleNewTerminal, handleCloseTerminal } = useTerminalPanel();

  return (
    <div className="terminal-panel">
      <div className="terminal-tab-bar">
        <div className="terminal-tabs-left">
          {terminals.map((term) => (
            <Tab
              key={term.id}
              displayName={term.title}
              isActive={activeTerminalId === term.id}
              onClick={() => setActiveTerminal(term.id)}
              onClose={() => handleCloseTerminal(term.id)}
            />
          ))}
          <button onClick={handleNewTerminal} className="new-terminal-button" title="New Terminal">
            +
          </button>
        </div>
        <button
          onClick={togglePanelPosition}
          className="toggle-panel-button"
          title={`Switch to ${panelPosition === 'side' ? 'bottom' : 'side'} panel`}
        >
          {panelPosition === 'side' ? '⬇' : '➡'}
        </button>
      </div>

      <div className="terminal-content">
        {terminals.map((term) => (
          <div
            key={term.id}
            className="terminal-wrapper"
            style={{ display: activeTerminalId === term.id ? 'block' : 'none' }}
          >
            <Terminal id={term.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
