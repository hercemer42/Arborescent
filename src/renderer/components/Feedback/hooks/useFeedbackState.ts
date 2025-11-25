import { useSyncExternalStore } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';
import { TreeStore } from '../../../store/tree/treeStore';

interface FeedbackState {
  collaboratingNodeId: string | null;
  feedbackStore: TreeStore | null;
}

/**
 * Hook to get the current feedback state for the active file
 * Returns the collaborating node ID and the feedback tree store
 */
export function useFeedbackState(): FeedbackState {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

  // Subscribe to tree store changes for the active file
  const collaboratingNodeId = useSyncExternalStore(
    (callback) => {
      if (!activeFilePath) return () => {};
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.subscribe(callback);
    },
    () => {
      if (!activeFilePath) return null;
      const store = storeManager.getStoreForFile(activeFilePath);
      return store.getState().collaboratingNodeId;
    },
    () => null
  );

  // Get feedback store for the active file
  // Fetched on each render - becomes available when processIncomingFeedbackContent initializes it
  const feedbackStore = activeFilePath ? feedbackTreeStore.getStoreForFile(activeFilePath) : null;

  return {
    collaboratingNodeId,
    feedbackStore,
  };
}
