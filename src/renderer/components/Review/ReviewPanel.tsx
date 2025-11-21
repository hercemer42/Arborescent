import { useEffect, useState } from 'react';
import { StatusBar } from './StatusBar';
import { useStore } from '../../store/tree/useStore';
import { logger } from '../../services/logger';
import { parseMarkdown, flattenNodes } from '../../utils/markdownParser';
import './ReviewPanel.css';

export function ReviewPanel() {
  const [reviewedContent, setReviewedContent] = useState<string | null>(null);
  const reviewingNodeId = useStore((state) => state.reviewingNodeId);
  const cancelReview = useStore((state) => state.actions.cancelReview);
  const acceptReview = useStore((state) => state.actions.acceptReview);

  // Listen for clipboard content detection
  useEffect(() => {
    const cleanup = window.electron.onClipboardContentDetected((content: string) => {
      logger.info('Received clipboard content for review', 'ReviewPanel');
      setReviewedContent(content);
    });

    return cleanup;
  }, []);

  // Clear reviewed content when review is cancelled
  useEffect(() => {
    if (!reviewingNodeId) {
      setReviewedContent(null);
    }
  }, [reviewingNodeId]);

  const handleCancel = async () => {
    try {
      // Stop clipboard monitoring
      await window.electron.stopClipboardMonitor();

      // Cancel review
      cancelReview();

      logger.info('Review cancelled', 'ReviewPanel');
    } catch (error) {
      logger.error('Failed to cancel review', error as Error, 'ReviewPanel');
    }
  };

  const handleAccept = async () => {
    if (!reviewedContent || !reviewingNodeId) {
      return;
    }

    try {
      // Parse markdown into nodes
      const newNodes = parseMarkdown(reviewedContent);

      if (newNodes.length === 0) {
        logger.error('No nodes parsed from markdown', new Error('Empty parse result'), 'ReviewPanel');
        return;
      }

      if (newNodes.length !== 1) {
        logger.error(`Expected 1 root node, got ${newNodes.length}`, new Error('Multiple roots not supported'), 'ReviewPanel');
        return;
      }

      const newRootNode = newNodes[0];

      // Flatten nodes into a map
      const newNodesMap = flattenNodes(newNodes);

      logger.info(`Parsed ${Object.keys(newNodesMap).length} total nodes from markdown`, 'ReviewPanel');

      // Replace the reviewing node with new nodes
      acceptReview(newRootNode.id, newNodesMap);

      // Stop clipboard monitoring
      await window.electron.stopClipboardMonitor();

      logger.info('Review accepted and node replaced', 'ReviewPanel');
    } catch (error) {
      logger.error('Failed to accept review', error as Error, 'ReviewPanel');
    }
  };

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
          onClick={handleAccept}
          disabled={!reviewedContent}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
