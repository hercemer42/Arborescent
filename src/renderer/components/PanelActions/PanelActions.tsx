import { usePanelActions } from './hooks/usePanelActions';
import './PanelActions.css';

export function PanelActions() {
  const { activeContent, reviewingNodeId, handleTerminalToggle, handleBrowserToggle, handleReviewShow } = usePanelActions();

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
      {reviewingNodeId && (
        <button
          className="panel-action-button"
          onClick={handleReviewShow}
          title="Show Review Panel"
        >
          {'📝'}
        </button>
      )}
    </div>
  );
}
