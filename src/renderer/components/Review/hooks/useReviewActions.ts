import { useStore } from '../../../store/tree/useStore';
import { parseMarkdown, flattenNodes } from '../../../utils/markdownParser';
import { logger } from '../../../services/logger';

/**
 * Hook providing accept and cancel actions for the review workflow
 */
export function useReviewActions() {
  const cancelReview = useStore((state) => state.actions.cancelReview);
  const acceptReview = useStore((state) => state.actions.acceptReview);

  const handleCancel = async () => {
    try {
      // Stop clipboard monitoring
      await window.electron.stopClipboardMonitor();

      // Cancel review
      cancelReview();

      logger.info('Review cancelled', 'ReviewActions');
    } catch (error) {
      logger.error('Failed to cancel review', error as Error, 'ReviewActions');
    }
  };

  const handleAccept = async (reviewedContent: string | null, reviewingNodeId: string | null) => {
    if (!reviewedContent || !reviewingNodeId) {
      return;
    }

    try {
      // Parse markdown into nodes
      const newNodes = parseMarkdown(reviewedContent);

      if (newNodes.length === 0) {
        logger.error('No nodes parsed from markdown', new Error('Empty parse result'), 'ReviewActions');
        return;
      }

      if (newNodes.length !== 1) {
        logger.error(`Expected 1 root node, got ${newNodes.length}`, new Error('Multiple roots not supported'), 'ReviewActions');
        return;
      }

      const newRootNode = newNodes[0];

      // Flatten nodes into a map
      const newNodesMap = flattenNodes(newNodes);

      logger.info(`Parsed ${Object.keys(newNodesMap).length} total nodes from markdown`, 'ReviewActions');

      // Replace the reviewing node with new nodes
      acceptReview(newRootNode.id, newNodesMap);

      // Stop clipboard monitoring
      await window.electron.stopClipboardMonitor();

      logger.info('Review accepted and node replaced', 'ReviewActions');
    } catch (error) {
      logger.error('Failed to accept review', error as Error, 'ReviewActions');
    }
  };

  return {
    handleCancel,
    handleAccept,
  };
}
