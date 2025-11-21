import { useRef } from 'react';
import { useReviewClipboard } from './hooks/useReviewClipboard';
import { useReviewActions } from './hooks/useReviewActions';
import { useReviewState } from './hooks/useReviewState';
import { useReviewKeyboard } from './hooks/useReviewKeyboard';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { Tree } from '../Tree';
import { ReviewTabBar } from './ReviewTabBar';
import './ReviewPanel.css';

export function ReviewPanel() {
  const { reviewingNodeId, reviewStore } = useReviewState();
  const hasReviewContent = useReviewClipboard(reviewingNodeId);
  const { handleCancel, handleAccept } = useReviewActions();
  const panelRef = useRef<HTMLDivElement>(null);

  useReviewKeyboard(panelRef, reviewStore);

  if (!reviewingNodeId) {
    return (
      <div className="review-panel" ref={panelRef}>
        <div className="review-empty">
          No active review
        </div>
      </div>
    );
  }

  return (
    <div className="review-panel" ref={panelRef}>
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
            Waiting for reviewed content to appear in clipboard...
          </div>
        )}
      </div>
    </div>
  );
}
