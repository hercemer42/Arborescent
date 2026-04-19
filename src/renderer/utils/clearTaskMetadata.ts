import type { NodeMetadata, TreeNode } from '@shared/types';

const TASK_FIELDS: (keyof NodeMetadata)[] = [
  'status',
  'resolvedAt',
  'feedbackTempFile',
  'appliedContextId',
  'appliedContextIds',
  'activeContextId',
  'decomposition',
  'recurse',
  'nextStepContext',
];

export function clearTaskMetadata(metadata: NodeMetadata): NodeMetadata {
  const result: NodeMetadata = { ...metadata };
  for (const field of TASK_FIELDS) {
    delete result[field];
  }
  return result;
}

export function declareNodeMetadata(
  nodes: Record<string, TreeNode>,
  nodeId: string,
  additions: Partial<NodeMetadata>,
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;
  return {
    ...nodes,
    [nodeId]: {
      ...node,
      metadata: { ...clearTaskMetadata(node.metadata), ...additions },
    },
  };
}
