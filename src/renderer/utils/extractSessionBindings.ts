import type { TreeNode } from '../../shared/types';

export type SessionBindingPair = { sessionId: string; nodeId: string };

export function extractSessionBindings(
  nodes: Record<string, TreeNode>,
): SessionBindingPair[] {
  const pairs: SessionBindingPair[] = [];
  for (const [nodeId, node] of Object.entries(nodes)) {
    const sessionId = node.metadata.sessionId;
    if (typeof sessionId === 'string' && sessionId.trim().length > 0) {
      pairs.push({ sessionId, nodeId });
    }
  }
  return pairs;
}
