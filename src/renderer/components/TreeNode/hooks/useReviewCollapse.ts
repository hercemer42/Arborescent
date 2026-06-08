import { useCallback } from 'react';
import {
  useReviewCollapseStore,
  selectReviewCollapseExpanded,
  type ReviewCollapseView,
} from '../../../store/reviewCollapse/reviewCollapseStore';

// Passed down to a proposition root so it draws its collapse state from the per-view store
// instead of the shared feedback node's metadata. `seedExpanded` is the fallback when the
// user has not toggled this root in this view yet.
export interface ReviewCollapseBinding {
  view: ReviewCollapseView;
  seedExpanded: boolean;
  reviewedNodeId: string;
}

interface ReviewCollapseControl {
  expanded: boolean;
  handleToggle: () => void;
}

export function useReviewCollapse(
  binding: ReviewCollapseBinding | undefined,
  propositionRootId: string,
): ReviewCollapseControl | null {
  const explicit = useReviewCollapseStore((state) =>
    binding ? selectReviewCollapseExpanded(state, binding.reviewedNodeId, binding.view, propositionRootId) : undefined,
  );

  const expanded = explicit ?? binding?.seedExpanded ?? true;

  // Only the collapse flag is written; unlike useNodeToggle there is no active-node
  // reselection, since selection lives in the live tree, not the feedback proposition.
  const handleToggle = useCallback(() => {
    if (!binding) return;
    useReviewCollapseStore
      .getState()
      .setExpanded(binding.reviewedNodeId, binding.view, propositionRootId, !expanded);
  }, [binding, propositionRootId, expanded]);

  if (!binding) return null;
  return { expanded, handleToggle };
}
