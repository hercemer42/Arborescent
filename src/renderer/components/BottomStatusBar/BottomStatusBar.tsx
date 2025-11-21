import { useEffect, useState } from 'react';
import { useStore } from '../../store/tree/useStore';
import { useReviewClipboard } from '../Review/hooks/useReviewClipboard';
import './BottomStatusBar.css';

export function BottomStatusBar() {
  const reviewingNodeId = useStore((state) => state.reviewingNodeId);
  const nodes = useStore((state) => state.nodes);
  const reviewedContent = useReviewClipboard(reviewingNodeId);
  const [flashMessage, setFlashMessage] = useState<string | null>(null);

  // Listen for review status changes to show flash messages
  useEffect(() => {
    const handleReviewAccepted = () => {
      setFlashMessage('Review accepted');
      setTimeout(() => setFlashMessage(null), 2000);
    };

    const handleReviewCanceled = () => {
      setFlashMessage('Review canceled');
      setTimeout(() => setFlashMessage(null), 2000);
    };

    window.addEventListener('review-accepted', handleReviewAccepted);
    window.addEventListener('review-canceled', handleReviewCanceled);

    return () => {
      window.removeEventListener('review-accepted', handleReviewAccepted);
      window.removeEventListener('review-canceled', handleReviewCanceled);
    };
  }, []);

  // Show flash message if present
  if (flashMessage) {
    return (
      <div className="bottom-status-bar bottom-status-bar-flash">
        <span className="status-message">{flashMessage}</span>
      </div>
    );
  }

  // Show nothing if no review in progress
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
    <div className="bottom-status-bar">
      <span className="status-message">{statusMessage}</span>
    </div>
  );
}
