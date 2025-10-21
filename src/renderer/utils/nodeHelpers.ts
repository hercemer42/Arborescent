import { TreeNode } from '../../shared/types';

export function updateNodeMetadata(
  nodes: Record<string, TreeNode>,
  nodeId: string,
  metadataUpdates: Partial<TreeNode['metadata']>
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;

  return {
    ...nodes,
    [nodeId]: {
      ...node,
      metadata: {
        ...node.metadata,
        ...metadataUpdates,
      },
    },
  };
}
