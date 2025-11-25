import { usePanelActions } from './hooks/usePanelActions';
import './PanelActions.css';

export function PanelActions() {
  const { activeContent, collaboratingNodeId, handleTerminalToggle, handleBrowserToggle, handleFeedbackShow } = usePanelActions();

  return (
    <div className="panel-actions">
      <button
        className="panel-action-button"
        onClick={handleTerminalToggle}
        title={activeContent === 'terminal' ? 'Hide Terminal (Ctrl+`)' : 'Show Terminal (Ctrl+`)'}
      >
        {'>_'}
      </button>
      <button
        className="panel-action-button"
        onClick={handleBrowserToggle}
        title={activeContent === 'browser' ? 'Hide Browser (Ctrl+B)' : 'Show Browser (Ctrl+B)'}
      >
        {'🌐'}
      </button>
      {collaboratingNodeId && (
        <button
          className="panel-action-button"
          onClick={handleFeedbackShow}
          title="Show Feedback Panel"
        >
          {'📝'}
        </button>
      )}
    </div>
  );
}
