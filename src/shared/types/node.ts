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
