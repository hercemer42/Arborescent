import { useSyncExternalStore } from 'react';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';
import { useStore } from '../../../store/tree/useStore';
import { isNodeInReview } from '../../../store/tree/reviews';
import type { TreeStore } from '../../../store/tree/treeStore';

// Returns the proposition store to render inline beneath a node when that node is the
// one under review and the AI has returned a proposition. Both single-root reviews and
// multi-root decomposition resolve here — decomposition renders its roots inline too.
export function useReviewProposition(nodeId: string): TreeStore | null {
  const isReviewedNode = useStore((state) => isNodeInReview(state.reviews, nodeId));
  const currentFilePath = useStore((state) => state.currentFilePath);

  useSyncExternalStore(
    feedbackTreeStore.subscribeToVersion.bind(feedbackTreeStore),
    feedbackTreeStore.getVersion.bind(feedbackTreeStore),
    () => 0,
  );

  if (!isReviewedNode || !currentFilePath) return null;

  const store = feedbackTreeStore.getStoreForNode(nodeId);
  if (!store) return null;

  const { nodes, rootNodeId } = store.getState();
  const propositionRootIds = nodes[rootNodeId]?.children ?? [];
  if (propositionRootIds.length === 0) return null;

  return store;
}
