import type { AncestorRegistry } from '../../utils/ancestry';

// A review runs from the moment a node is sent for review until its proposition is accepted or
// cancelled. Terminal/MCP reviews run concurrently; a browser review is exclusive (it carries no
// session identity, so its clipboard-delivered proposition must have a single unambiguous home).
export type ReviewSource = 'browser' | 'terminal';

export interface ReviewEntry {
  source: ReviewSource;
  terminalId: string | null;
}

export type ReviewMap = Record<string, ReviewEntry>;

// Readers treat a missing map as no reviews so they stay safe against partial/initial state.
export function getInReviewNodeIds(reviews: ReviewMap | undefined): string[] {
  return Object.keys(reviews ?? {});
}

export function isNodeInReview(reviews: ReviewMap | undefined, nodeId: string): boolean {
  return reviews != null && nodeId in reviews;
}

export function isReviewDescendant(
  reviews: ReviewMap | undefined,
  nodeId: string,
  ancestorRegistry: AncestorRegistry,
): boolean {
  if (reviews == null) return false;
  const ancestors = ancestorRegistry[nodeId] ?? [];
  return ancestors.some((ancestorId) => ancestorId in reviews);
}

// The reviewed nodes that sit within the subtree rooted at nodeId (the node itself or any
// descendant). Used to warn before deleting an ancestor and to discard those reviews on delete.
export function reviewsInSubtree(
  reviews: ReviewMap | undefined,
  nodeId: string,
  ancestorRegistry: AncestorRegistry,
): string[] {
  return getInReviewNodeIds(reviews).filter(
    (reviewedId) => reviewedId === nodeId || (ancestorRegistry[reviewedId] ?? []).includes(nodeId),
  );
}

export function getBrowserReviewNodeId(reviews: ReviewMap | undefined): string | null {
  const entry = Object.entries(reviews ?? {}).find(([, review]) => review.source === 'browser');
  return entry ? entry[0] : null;
}

export function hasBrowserReview(reviews: ReviewMap | undefined): boolean {
  return getBrowserReviewNodeId(reviews) !== null;
}

export function addReview(reviews: ReviewMap | undefined, nodeId: string, entry: ReviewEntry): ReviewMap {
  return { ...(reviews ?? {}), [nodeId]: entry };
}

export function removeReview(reviews: ReviewMap | undefined, nodeId: string): ReviewMap {
  const map = reviews ?? {};
  if (!(nodeId in map)) return map;
  const next = { ...map };
  delete next[nodeId];
  return next;
}
