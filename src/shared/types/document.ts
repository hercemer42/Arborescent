import { TreeNode } from './treeNode';

export type TreeType = 'workspace' | 'review';

export interface ArboFile {
  format: 'Arborescent';
  version: string;
  created: string;
  updated: string;
  author: string;
  treeType?: TreeType;
  rootNodeId: string;
  nodes: Record<string, TreeNode>;
}
