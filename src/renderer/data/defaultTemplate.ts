import { TreeNode } from '../../shared/types';

export function createBlankDocument(): {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  firstNodeId: string;
} {
  const rootId = 'root';
  const firstNodeId = 'node-1';

  return {
    nodes: {
      [rootId]: {
        id: rootId,
        content: '',
        children: [firstNodeId],
        metadata: {},
      },
      [firstNodeId]: {
        id: firstNodeId,
        content: '',
        children: [],
        metadata: { status: 'pending' },
      },
    },
    rootNodeId: rootId,
    firstNodeId,
  };
}
