import { TreeNode } from './treeNode';

// A pending AI proposition for a node under review. The proposition is held as a
// full subtree snapshot with remapped ids, keyed (in PendingProposalMap) by the
// reviewed node id — the same shape as a step-history snapshot. It is promoted onto
// the reviewed node's id only when accepted.
export interface PendingProposalEntry {
  id: string;
  capturedAt: string;
  reviewedNodeId: string;
  rootNodeId: string;
  nodes: Record<string, TreeNode>;
}

export type PendingProposalMap = Record<string, PendingProposalEntry>;
