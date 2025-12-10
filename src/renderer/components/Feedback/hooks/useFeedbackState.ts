import { useSyncExternalStore } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';
import { TreeStore } from '../../../store/tree/treeStore';

interface FeedbackState {
  collaboratingNodeId: string | null;
  feedbackStore: TreeStore | null;
  feedbackVersion: number;
}

export function useFeedbackState(): FeedbackState {
  const activeFilePath = useFilesStore((state) => state.activeFilePath);

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

  const feedbackVersion = useSyncExternalStore(
    (callback) => feedbackTreeStore.subscribeToVersion(callback),
    () => feedbackTreeStore.getVersion(),
    () => 0
  );

  const feedbackStore = activeFilePath ? feedbackTreeStore.getStoreForFile(activeFilePath) : null;

  return {
    collaboratingNodeId,
    feedbackStore,
    feedbackVersion,
  };
}
