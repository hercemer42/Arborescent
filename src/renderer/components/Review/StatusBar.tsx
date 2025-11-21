import { useStore } from '../../store/tree/useStore';
import './StatusBar.css';

export function StatusBar() {
  const reviewingNodeId = useStore((state) => state.reviewingNodeId);
  const nodes = useStore((state) => state.nodes);

  if (!reviewingNodeId) {
    return null;
  }

  const node = nodes[reviewingNodeId];
  if (!node) {
    return null;
  }

  // Truncate content for display
  const maxLength = 100;
  const displayContent = node.content.length > maxLength
    ? node.content.substring(0, maxLength) + '...'
    : node.content;

  return (
    <div className="review-status-bar">
      <span className="review-status-label">Reviewing:</span>
      <span className="review-status-content">{displayContent}</span>
    </div>
  );
}
