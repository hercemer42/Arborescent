import { StatusBar } from './StatusBar';
import { useStore } from '../../store/tree/useStore';
import { useReviewClipboard } from './hooks/useReviewClipboard';
import { useReviewActions } from './hooks/useReviewActions';
import './ReviewPanel.css';

export function ReviewPanel() {
  const reviewingNodeId = useStore((state) => state.reviewingNodeId);
  const reviewedContent = useReviewClipboard(reviewingNodeId);
  const { handleCancel, handleAccept } = useReviewActions();

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
      <StatusBar />

      <div className="review-content">
        {reviewedContent ? (
          <div className="review-preview">
            <div className="review-preview-header">Reviewed content:</div>
            <div className="review-preview-content">{reviewedContent}</div>
          </div>
        ) : (
          <div className="review-waiting">
            Waiting for reviewed content...
          </div>
        )}
      </div>

      <div className="review-actions">
        <button
          className="review-button review-button-cancel"
          onClick={handleCancel}
        >
          Cancel
        </button>
        <button
          className="review-button review-button-accept"
          onClick={() => handleAccept(reviewedContent, reviewingNodeId)}
          disabled={!reviewedContent}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
