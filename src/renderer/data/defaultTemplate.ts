import { TreeNode } from '../../shared/types';
import { createTreeNode } from '../utils/nodeHelpers';

export function createBlankDocument(): {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  firstNodeId: string;
} {
  const rootId = 'root';
  const firstNodeId = 'node-1';

  return {
    nodes: {
      [rootId]: createTreeNode(rootId, {
        children: [firstNodeId],
        metadata: { isRoot: true, isBlueprint: true },
      }),
      [firstNodeId]: createTreeNode(firstNodeId, {
        metadata: { status: 'pending' },
      }),
    },
    rootNodeId: rootId,
    firstNodeId,
  };
}
