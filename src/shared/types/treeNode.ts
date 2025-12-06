export type NodeStatus = 'pending' | 'completed' | 'abandoned';

export const STATUS_SYMBOLS: Record<NodeStatus, string> = {
  pending: '☐',
  completed: '✓',
  abandoned: '✗',
};

export interface TransientMetadata {
  isCut?: boolean;
}

export interface TreeNode {
  id: string;
  content: string;
  children: string[];
  metadata: {
    status?: NodeStatus;
    expanded?: boolean;
    created?: string;
    updated?: string;
    plugins?: Record<string, Record<string, unknown>>;
    feedbackTempFile?: string; // Path to temporary file storing feedback content
    transient?: TransientMetadata; // In-memory only, not persisted to file
    [key: string]: unknown;
  };
}
