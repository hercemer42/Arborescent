import type { AncestorRegistry } from './ancestry';

// A review may not nest inside, or engulf, an existing review region: a node overlaps the
// in-review set if it is itself in review, or if any of its ancestors or descendants is.
export function isReviewOverlap(
  nodeId: string,
  inReviewNodeIds: string[],
  ancestorRegistry: AncestorRegistry,
): boolean {
  if (inReviewNodeIds.includes(nodeId)) return true;

  const ancestors = ancestorRegistry[nodeId] ?? [];
  if (ancestors.some((ancestorId) => inReviewNodeIds.includes(ancestorId))) return true;

  return inReviewNodeIds.some((reviewedId) => (ancestorRegistry[reviewedId] ?? []).includes(nodeId));
}
