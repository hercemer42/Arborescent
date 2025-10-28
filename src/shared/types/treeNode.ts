export type NodeStatus = 'pending' | 'completed' | 'failed';

export const STATUS_SYMBOLS: Record<NodeStatus, string> = {
  pending: '☐',
  completed: '✓',
  failed: '✗',
};

export interface TreeNode {
  id: string;
  content: string;
  children: string[];
  metadata: {
    status?: NodeStatus;
    expanded?: boolean;
    created?: string;
    updated?: string;
    [key: string]: unknown;
  };
}
