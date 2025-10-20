export type NodeStatus = '☐' | '✓' | '✗';

export interface TreeNode {
  id: string;
  content: string;
  children: string[];
  metadata: {
    status?: NodeStatus;
    created?: string;
    updated?: string;
    [key: string]: unknown;
  };
}
