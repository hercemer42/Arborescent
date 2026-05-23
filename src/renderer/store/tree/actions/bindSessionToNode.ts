import type { TreeNode } from '../../../../shared/types';

interface NodesState {
  nodes: Record<string, TreeNode>;
}

type SetState = (partial: { nodes?: Record<string, TreeNode> }) => void;

export function bindSessionInNodes(
  nodes: Record<string, TreeNode>,
  sessionId: string,
  nodeId: string,
): Record<string, TreeNode> {
  if (typeof sessionId !== 'string' || sessionId.trim().length === 0) return nodes;
  if (!nodeId) return nodes;
  if (!nodes[nodeId]) return nodes;

  const target = nodes[nodeId];
  const targetAlreadyHolds = target.metadata.sessionId === sessionId;

  const updated: Record<string, TreeNode> = {};
  let mutated = false;

  for (const [id, node] of Object.entries(nodes)) {
    if (id === nodeId) {
      if (targetAlreadyHolds) {
        updated[id] = node;
      } else {
        const nextMetadata = { ...node.metadata, sessionId };
        updated[id] = { ...node, metadata: nextMetadata };
        mutated = true;
      }
      continue;
    }

    if (node.metadata.sessionId === sessionId) {
      const nextMetadata = { ...node.metadata };
      delete nextMetadata.sessionId;
      updated[id] = { ...node, metadata: nextMetadata };
      mutated = true;
      continue;
    }

    updated[id] = node;
  }

  return mutated ? updated : nodes;
}

export function bindSessionToNode(
  sessionId: string,
  nodeId: string,
  getState: () => NodesState,
  setState: SetState,
): void {
  if (!sessionId || !nodeId) return;
  const { nodes } = getState();
  if (!nodes[nodeId]) return;

  const updated = bindSessionInNodes(nodes, sessionId, nodeId);
  if (updated === nodes) return;

  setState({ nodes: updated });
}
