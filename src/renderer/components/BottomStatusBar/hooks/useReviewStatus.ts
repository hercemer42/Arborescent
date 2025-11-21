import { useSyncExternalStore } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';
import { reviewTreeStore } from '../../../store/review/reviewTreeStore';

/**
 * Hook to compute the review status message
 * Returns null if no review is in progress
 */
export function useReviewStatus(): string | null {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  // Subscribe to tree store changes for the active file
  const treeState = useSyncExternalStore(
    (callback) => {
      if (!activeFilePath) return () => {};
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.subscribe(callback);
    },
    () => {
      if (!activeFilePath) return null;
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.getState();
    },
    () => null
  );

  // No active file or tree state
  if (!activeFilePath || !treeState) {
    return null;
  }

  const { reviewingNodeId, nodes } = treeState;

  // No review in progress
  if (!reviewingNodeId) {
    return null;
  }

  const node = nodes[reviewingNodeId];
  if (!node) {
    return null;
  }

  // Check if review content is available
  const hasReviewContent = reviewTreeStore.hasReview(activeFilePath);

  // Truncate node name to 15 characters
  const maxLength = 15;
  const nodeName = node.content.length > maxLength
    ? node.content.substring(0, maxLength) + '...'
    : node.content;

  // Show different messages based on state
  return hasReviewContent
    ? `Review in progress for node ${nodeName}`
    : `Waiting for review for node ${nodeName}`;
}
