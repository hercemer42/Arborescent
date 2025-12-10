import { useSyncExternalStore } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';

export function useFeedbackStatus(): string | null {
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

  const { collaboratingNodeId, nodes } = treeState;

  // No collaboration in progress
  if (!collaboratingNodeId) {
    return null;
  }

  const node = nodes[collaboratingNodeId];
  if (!node) {
    return null;
  }

  // Check if feedback content is available
  const hasFeedbackContent = feedbackTreeStore.hasFeedback(activeFilePath);

  // Truncate node name to 15 characters
  const maxLength = 15;
  const nodeName = node.content.length > maxLength
    ? node.content.substring(0, maxLength) + '...'
    : node.content;

  // Show different messages based on state
  return hasFeedbackContent
    ? `Collaboration in progress for node ${nodeName}`
    : `Waiting for feedback for node ${nodeName}`;
}
