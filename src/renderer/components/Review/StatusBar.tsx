import { useStore } from '../../store/tree/useStore';
import { useReviewClipboard } from './hooks/useReviewClipboard';
import './StatusBar.css';

export function StatusBar() {
  const reviewingNodeId = useStore((state) => state.reviewingNodeId);
  const nodes = useStore((state) => state.nodes);
  const reviewedContent = useReviewClipboard(reviewingNodeId);

  if (!reviewingNodeId) {
    return null;
  }

  const node = nodes[reviewingNodeId];
  if (!node) {
    return null;
  }

  // Truncate node name to 15 characters
  const maxLength = 15;
  const nodeName = node.content.length > maxLength
    ? node.content.substring(0, maxLength) + '...'
    : node.content;

  // Show different messages based on state
  const statusMessage = reviewedContent
    ? `Review in progress for node ${nodeName}`
    : `Waiting for review for node ${nodeName}`;

  return (
    <div className="review-status-bar">
      <span className="review-status-message">{statusMessage}</span>
    </div>
  );
}
