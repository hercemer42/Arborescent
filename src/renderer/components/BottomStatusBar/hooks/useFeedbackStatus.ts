import { useSyncExternalStore } from 'react';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';
import { getInReviewNodeIds } from '../../../store/tree/reviews';

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

  // Re-render on feedback working-store version bumps so the Waiting → In progress transition
  // shows immediately rather than relying on an incidental tree re-render.
  useSyncExternalStore(
    feedbackTreeStore.subscribeToVersion.bind(feedbackTreeStore),
    feedbackTreeStore.getVersion.bind(feedbackTreeStore),
    () => 0,
  );

  // No active file or tree state
  if (!activeFilePath || !treeState) {
    return null;
  }

  const reviewedIds = getInReviewNodeIds(treeState.reviews);

  // No collaboration in progress
  if (reviewedIds.length === 0) {
    return null;
  }

  if (reviewedIds.length > 1) {
    return `${reviewedIds.length} reviews in progress`;
  }

  const reviewedNodeId = reviewedIds[0];
  const node = treeState.nodes[reviewedNodeId];
  if (!node) {
    return null;
  }

  // Check if feedback content is available
  const hasFeedbackContent = feedbackTreeStore.hasFeedbackForNode(reviewedNodeId);

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
