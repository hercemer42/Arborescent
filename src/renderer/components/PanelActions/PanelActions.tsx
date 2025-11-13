import { useTerminalStore } from '../../store/terminal/terminalStore';
import './PanelActions.css';

export function PanelActions() {
  const { isTerminalVisible, toggleTerminalVisibility } = useTerminalStore();

  return (
    <div className="panel-actions">
      <button
        className="panel-action-button"
        onClick={toggleTerminalVisibility}
        title={isTerminalVisible ? 'Hide Terminal (Ctrl+`)' : 'Show Terminal (Ctrl+`)'}
      >
        {'>_'}
      </button>
    </div>
  );
}
