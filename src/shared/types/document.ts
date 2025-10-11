import { Node, NodeTypeConfig } from './node';

export interface Document {
  version: '1.0';
  rootNodeId: string;
  nodes: Record<string, Node>;
  nodeTypeConfig?: Record<string, NodeTypeConfig>;
}

export interface ArboFile {
  format: 'Arborescent';
  version: string;
  created: string;
  updated: string;
  author: string;
  rootNodeId: string;
  nodes: Record<string, Node>;
  nodeTypeConfig?: Record<string, NodeTypeConfig>;
}
