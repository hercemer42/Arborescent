import { useStore } from '../../store/tree/useStore';
import { useReviewClipboard } from './hooks/useReviewClipboard';
import { useReviewActions } from './hooks/useReviewActions';
import { useFilesStore } from '../../store/files/filesStore';
import { reviewTreeStore } from '../../store/review/reviewTreeStore';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { Tree } from '../Tree';
import { ReviewTabBar } from './ReviewTabBar';
import './ReviewPanel.css';

export function ReviewPanel() {
  const reviewingNodeId = useStore((state) => state.reviewingNodeId);
  const activeFilePath = useFilesStore((state) => state.activeFilePath);
  const hasReviewContent = useReviewClipboard(reviewingNodeId);
  const { handleCancel, handleAccept } = useReviewActions();

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
      <ReviewTabBar
        hasReviewContent={hasReviewContent}
        onAccept={() => handleAccept()}
        onCancel={() => handleCancel()}
      />

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
