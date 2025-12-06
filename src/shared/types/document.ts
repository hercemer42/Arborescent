import { TreeNode } from './treeNode';

export type TreeType = 'workspace' | 'feedback';

export interface ArboFile {
  format: 'Arborescent';
  version: string;
  created: string;
  updated: string;
  author: string;
  treeType?: TreeType;
  isBlueprint?: boolean;
  rootNodeId: string;
  nodes: Record<string, TreeNode>;
}
