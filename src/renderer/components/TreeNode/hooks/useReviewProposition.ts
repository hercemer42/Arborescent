import { useSyncExternalStore } from 'react';
import { feedbackTreeStore } from '../../../store/feedback/feedbackTreeStore';
import { useStore } from '../../../store/tree/useStore';
import type { TreeStore } from '../../../store/tree/treeStore';

// Returns the proposition store to render inline beneath a node when that node is the
// one under review and the AI has returned a single-root proposition. Decomposition
// (multi-root) proposals still resolve to null here and continue to use the panel.
export function useReviewProposition(nodeId: string): TreeStore | null {
  const isReviewedNode = useStore((state) => state.collaboratingNodeId === nodeId);
  const currentFilePath = useStore((state) => state.currentFilePath);

  useSyncExternalStore(
    feedbackTreeStore.subscribeToVersion.bind(feedbackTreeStore),
    feedbackTreeStore.getVersion.bind(feedbackTreeStore),
    () => 0,
  );

  if (!isReviewedNode || !currentFilePath) return null;

  const store = feedbackTreeStore.getStoreForFile(currentFilePath);
  if (!store) return null;

  const { nodes, rootNodeId } = store.getState();
  const propositionRootIds = nodes[rootNodeId]?.children ?? [];
  if (propositionRootIds.length !== 1) return null;

  return store;
}
