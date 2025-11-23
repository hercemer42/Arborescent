import { useSyncExternalStore } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';
import { reviewTreeStore } from '../../../store/review/reviewTreeStore';
import { TreeStore } from '../../../store/tree/treeStore';

interface ReviewState {
  reviewingNodeId: string | null;
  reviewStore: TreeStore | null;
}

/**
 * Hook to get the current review state for the active file
 * Returns the reviewing node ID and the review tree store
 */
export function useReviewState(): ReviewState {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  // Subscribe to tree store changes for the active file
  const reviewingNodeId = useSyncExternalStore(
    (callback) => {
      if (!activeFilePath) return () => {};
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.subscribe(callback);
    },
    () => {
      if (!activeFilePath) return null;
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.getState().reviewingNodeId;
    },
    () => null
  );

  // Get review store for the active file
  // Fetched on each render - becomes available when processIncomingReviewContent initializes it
  const reviewStore = activeFilePath ? reviewTreeStore.getStoreForFile(activeFilePath) : null;

  return {
    reviewingNodeId,
    reviewStore,
  };
}
