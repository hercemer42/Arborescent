import { logger } from '../../../services/logger';
import { usePanelStore } from '../../../store/panel/panelStore';
import { deleteReviewTempFile } from '../../../services/review/reviewTempFileService';
import { reviewTreeStore } from '../../../store/review/reviewTreeStore';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';

/**
 * Hook providing accept and cancel actions for the review workflow
 */
export function useReviewActions() {
  const hidePanel = usePanelStore((state) => state.hidePanel);

  const handleCancel = async () => {
    try {
      // Get active file path
      const activeFilePath = useFilesStore.getState().activeFilePath;
      if (!activeFilePath) return;

      // Get store for this file
      const store = storeManager.getStoreForFile(activeFilePath);
      const state = store.getState();
      const tempFilePath = state.reviewingNodeId && state.nodes[state.reviewingNodeId]?.metadata.reviewTempFile;

      // Stop clipboard monitoring and file watching
      await window.electron.stopClipboardMonitor();
      await window.electron.stopReviewFileWatcher();

      // Cancel review using action from store
      store.getState().actions.cancelReview();

      // Delete temp file if it exists
      if (tempFilePath) {
        await deleteReviewTempFile(tempFilePath);
      }

      // Dispatch event for status bar flash message
      window.dispatchEvent(new Event('review-canceled'));

      logger.info('Review cancelled', 'ReviewActions');
    } catch (error) {
      logger.error('Failed to cancel review', error as Error, 'ReviewActions');
    }
  };

  const handleAccept = async () => {
    try {
      // Get active file path
      const activeFilePath = useFilesStore.getState().activeFilePath;
      if (!activeFilePath) return;

      // Get the review tree store for this file
      const reviewStore = reviewTreeStore.getStoreForFile(activeFilePath);
      if (!reviewStore) {
        logger.error('No review store available', new Error('Review store not initialized'), 'ReviewActions');
        return;
      }

      // Get nodes and rootNodeId from the review store (includes any edits made by user)
      const reviewState = reviewStore.getState();
      const { nodes: reviewNodes, rootNodeId: reviewRootNodeId } = reviewState;

      // The review store has a hidden root node - get the actual content root
      const hiddenRoot = reviewNodes[reviewRootNodeId];
      if (!hiddenRoot || hiddenRoot.children.length === 0) {
        logger.error('Review store has no content', new Error('Empty review'), 'ReviewActions');
        return;
      }

      // Get the actual content root (first child of hidden root)
      const actualRootNodeId = hiddenRoot.children[0];

      // Filter out the hidden root from the nodes map
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [reviewRootNodeId]: _hiddenRoot, ...contentNodes } = reviewNodes;

      logger.info(`Accepting review with ${Object.keys(contentNodes).length} nodes`, 'ReviewActions');

      // Get temp file path from reviewing node metadata before accepting
      const mainStore = storeManager.getStoreForFile(activeFilePath);
      const mainState = mainStore.getState();
      const currentReviewingNodeId = mainState.reviewingNodeId;
      const tempFilePath = currentReviewingNodeId && mainState.nodes[currentReviewingNodeId]?.metadata.reviewTempFile;

      // Replace the reviewing node with nodes from review store - use action from store
      mainStore.getState().actions.acceptReview(actualRootNodeId, contentNodes);

      // Stop clipboard monitoring and file watching
      await window.electron.stopClipboardMonitor();
      await window.electron.stopReviewFileWatcher();

      // Delete temp file if it exists
      if (tempFilePath) {
        await deleteReviewTempFile(tempFilePath);
      }

      // Clear the review store for this file
      reviewTreeStore.clearFile(activeFilePath);

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
