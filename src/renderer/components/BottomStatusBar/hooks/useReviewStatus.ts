import { useStore } from '../../../store/tree/useStore';
import { useReviewClipboard } from '../../Review/hooks/useReviewClipboard';

/**
 * Hook to compute the review status message
 * Returns null if no review is in progress
 */
export function useReviewStatus(): string | null {
  const reviewingNodeId = useStore((state) => state.reviewingNodeId);
  const nodes = useStore((state) => state.nodes);
  const reviewedContent = useReviewClipboard(reviewingNodeId);

  // No review in progress
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
  return reviewedContent
    ? `Review in progress for node ${nodeName}`
    : `Waiting for review for node ${nodeName}`;
}
