import { TreeNode } from './treeNode';
import { PendingProposalMap } from './pendingProposal';

export type TreeType = 'workspace' | 'feedback';

export interface ArboFile {
  format: 'Arborescent';
  version: string;
  created: string;
  updated: string;
  author: string;
  treeType?: TreeType;
  isBlueprint?: boolean;
  summaryDateFrom?: string;
  summaryDateTo?: string;
  rootNodeId: string;
  nodes: Record<string, TreeNode>;
  sessionRegistry?: Record<string, { cwd: string }>;
  pendingProposals?: PendingProposalMap;
}
