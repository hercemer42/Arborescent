import { useStore } from '../../../store/tree/useStore';
import { logger } from '../../../services/logger';
import { usePanelStore } from '../../../store/panel/panelStore';
import { deleteReviewTempFile } from '../../../utils/reviewTempFiles';
import { reviewTreeStore } from '../../../store/review/reviewTreeStore';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';

/**
 * Hook providing accept and cancel actions for the review workflow
 */
export function useReviewActions() {
  const cancelReview = useStore((state) => state.actions.cancelReview);
  const acceptReview = useStore((state) => state.actions.acceptReview);
  const hidePanel = usePanelStore((state) => state.hidePanel);

  const handleCancel = async () => {
    try {
      // Get temp file path from reviewing node metadata before canceling
      const activeFilePath = useFilesStore.getState().activeFilePath;
      if (!activeFilePath) return;

      const store = storeManager.getStoreForFile(activeFilePath);
      const state = store.getState();
      const tempFilePath = state.reviewingNodeId && state.nodes[state.reviewingNodeId]?.metadata.reviewTempFile;

      // Stop clipboard monitoring
      await window.electron.stopClipboardMonitor();

      // Cancel review
      cancelReview();

      // Delete temp file if it exists
      if (tempFilePath) {
        await deleteReviewTempFile(tempFilePath);
      }

      // Hide the review panel
      hidePanel();

      // Dispatch event for status bar flash message
      window.dispatchEvent(new Event('review-canceled'));

      logger.info('Review cancelled', 'ReviewActions');
    } catch (error) {
      logger.error('Failed to cancel review', error as Error, 'ReviewActions');
    }
  };

  const handleAccept = async () => {
    try {
      // Get the review tree store
      const reviewStore = reviewTreeStore.getStore();
      if (!reviewStore) {
        logger.error('No review store available', new Error('Review store not initialized'), 'ReviewActions');
        return;
      }

      // Get nodes and rootNodeId from the review store (includes any edits made by user)
      const reviewState = reviewStore.getState();
      const { nodes: reviewNodes, rootNodeId: reviewRootNodeId } = reviewState;

      logger.info(`Accepting review with ${Object.keys(reviewNodes).length} nodes`, 'ReviewActions');

      // Get temp file path from reviewing node metadata before accepting
      const activeFilePath = useFilesStore.getState().activeFilePath;
      if (!activeFilePath) return;

      const mainStore = storeManager.getStoreForFile(activeFilePath);
      const mainState = mainStore.getState();
      const currentReviewingNodeId = mainState.reviewingNodeId;
      const tempFilePath = currentReviewingNodeId && mainState.nodes[currentReviewingNodeId]?.metadata.reviewTempFile;

      // Replace the reviewing node with nodes from review store
      acceptReview(reviewRootNodeId, reviewNodes);

      // Stop clipboard monitoring
      await window.electron.stopClipboardMonitor();

      // Delete temp file if it exists
      if (tempFilePath) {
        await deleteReviewTempFile(tempFilePath);
      }

      // Clear the review store
      reviewTreeStore.clear();

      // Hide the review panel
      hidePanel();

      // Dispatch event for status bar flash message
      window.dispatchEvent(new Event('review-accepted'));

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
