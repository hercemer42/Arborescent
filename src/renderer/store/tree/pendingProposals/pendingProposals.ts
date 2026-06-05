import { v4 as uuidv4 } from 'uuid';
import type { PendingProposalEntry, PendingProposalMap, TreeNode } from '../../../../shared/types';
import { captureRemappedSubtree } from '../stepHistory/stepHistory';

export type { PendingProposalEntry, PendingProposalMap };

// Snapshots the proposition subtree with fresh ids (so it can never collide with the
// live tree) and tags it with the reviewed node it targets. Mirrors a step-history
// capture; the snapshot adopts the reviewed node's id only when promoted.
export function capturePendingProposal(
  reviewedNodeId: string,
  propositionRootId: string,
  propositionNodes: Record<string, TreeNode>,
): PendingProposalEntry {
  const remapped = captureRemappedSubtree(propositionRootId, propositionNodes);
  return {
    id: uuidv4(),
    capturedAt: new Date().toISOString(),
    reviewedNodeId,
    rootNodeId: remapped.rootNodeId,
    nodes: remapped.nodes,
  };
}

export function setPendingProposal(
  map: PendingProposalMap,
  entry: PendingProposalEntry,
): PendingProposalMap {
  return { ...map, [entry.reviewedNodeId]: entry };
}

export function dropPendingProposal(
  map: PendingProposalMap,
  reviewedNodeId: string,
): PendingProposalMap {
  if (!(reviewedNodeId in map)) return map;
  const next = { ...map };
  delete next[reviewedNodeId];
  return next;
}
