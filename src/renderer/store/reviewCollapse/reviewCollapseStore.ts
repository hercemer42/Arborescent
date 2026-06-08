import { create } from 'zustand';

// A review suggestion's collapse state is per-view: the same proposition root renders in
// both the main tab and a zoom tab, so its expansion cannot live on the shared feedback
// node. This store holds only explicit user toggles, keyed by reviewed node, then by
// view + proposition root. Absent an entry the renderer falls back to a per-view seed
// (main mirrors the reviewed node, zoom forces expanded). Entries are transient and dropped
// when the review resolves.
export type ReviewCollapseView = 'main' | 'zoom';

export function reviewCollapseKey(view: ReviewCollapseView, propositionRootId: string): string {
  return `${view}:${propositionRootId}`;
}

interface ReviewCollapseState {
  byReview: Record<string, Record<string, boolean>>;
  setExpanded: (reviewedNodeId: string, view: ReviewCollapseView, propositionRootId: string, expanded: boolean) => void;
  clearForReview: (reviewedNodeId: string) => void;
}

export const useReviewCollapseStore = create<ReviewCollapseState>((set) => ({
  byReview: {},

  setExpanded(reviewedNodeId, view, propositionRootId, expanded) {
    set((state) => ({
      byReview: {
        ...state.byReview,
        [reviewedNodeId]: {
          ...state.byReview[reviewedNodeId],
          [reviewCollapseKey(view, propositionRootId)]: expanded,
        },
      },
    }));
  },

  clearForReview(reviewedNodeId) {
    set((state) => {
      if (!state.byReview[reviewedNodeId]) return state;
      const next = { ...state.byReview };
      delete next[reviewedNodeId];
      return { byReview: next };
    });
  },
}));

export function selectReviewCollapseExpanded(
  state: ReviewCollapseState,
  reviewedNodeId: string,
  view: ReviewCollapseView,
  propositionRootId: string,
): boolean | undefined {
  return state.byReview[reviewedNodeId]?.[reviewCollapseKey(view, propositionRootId)];
}
