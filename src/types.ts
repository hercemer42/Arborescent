export type NodeType = string;
export type NodeStatus = '☐' | '✓' | '✗';

export interface NodeTypeConfig {
  icon: string;
  style: string;
}

export interface Node {
  id: string;
  type: NodeType;
  content: string;
  children: string[];
  metadata: {
    status?: NodeStatus;
    created?: string;
    updated?: string;
    [key: string]: unknown;
  };
}

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
}
