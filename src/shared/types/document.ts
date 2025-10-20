import { TreeNode } from './treeNode';

export interface Document {
  version: '1.0';
  rootNodeId: string;
  nodes: Record<string, TreeNode>;
}

export interface ArboFile {
  format: 'Arborescent';
  version: string;
  created: string;
  updated: string;
  author: string;
  rootNodeId: string;
  nodes: Record<string, TreeNode>;
}
