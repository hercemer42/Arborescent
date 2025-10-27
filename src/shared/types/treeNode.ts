export type NodeStatus = '☐' | '✓' | '✗';

export interface TreeNode {
  id: string;
  content: string;
  children: string[];
  metadata: {
    status?: NodeStatus;
    expanded?: boolean;
    created?: string;
    updated?: string;
    deleted?: boolean;
    deletedAt?: number;
    [key: string]: unknown;
  };
}
