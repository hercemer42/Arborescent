import { useStore } from '../../store/tree/useStore';
import { useReviewClipboard } from './hooks/useReviewClipboard';
import { useReviewActions } from './hooks/useReviewActions';
import { usePanelStore } from '../../store/panel/panelStore';
import { useFilesStore } from '../../store/files/filesStore';
import { reviewTreeStore } from '../../store/review/reviewTreeStore';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { Tree } from '../Tree';
import './ReviewPanel.css';

export function ReviewPanel() {
  const reviewingNodeId = useStore((state) => state.reviewingNodeId);
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const hasReviewContent = useReviewClipboard(reviewingNodeId);
  const { handleCancel, handleAccept } = useReviewActions();
  const panelPosition = usePanelStore((state) => state.panelPosition);
  const togglePanelPosition = usePanelStore((state) => state.togglePanelPosition);

  // Get review store for the active file
  const reviewStore = activeFilePath ? reviewTreeStore.getStoreForFile(activeFilePath) : null;

  if (!reviewingNodeId) {
    return (
      <div className="review-panel">
        <div className="review-empty">
          No active review
        </div>
      </div>
    );
  }

  return (
    <div className="review-panel">
      <div className="review-tab-bar">
        <div className="review-actions-left">
          <button
            className="review-button review-button-accept"
            onClick={() => handleAccept()}
            disabled={!hasReviewContent}
            title="Accept reviewed changes"
          >
            Accept
          </button>
          <button
            className="review-button review-button-cancel"
            onClick={() => handleCancel()}
            title="Cancel review"
          >
            Cancel
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

      <div className="review-content">
        {hasReviewContent && reviewStore ? (
          <TreeStoreContext.Provider value={reviewStore}>
            <Tree />
          </TreeStoreContext.Provider>
        ) : (
          <div className="review-waiting">
            Waiting for reviewed content...
          </div>
        )}
      </div>
    </div>
  );
}
