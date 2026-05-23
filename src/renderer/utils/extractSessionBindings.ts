import type { TreeNode } from '../../shared/types';

export type SessionBindingPair = { sessionId: string; nodeId: string };

// Dedup per sessionId — legacy .arbo files (pre-sessionId-uniqueness) may stamp
// the same sessionId on multiple nodes. Callers can pass a preferred-node set to
// influence which holder wins the seed; otherwise the lexicographically-first
// candidate is picked deterministically.
export function extractSessionBindings(
  nodes: Record<string, TreeNode>,
  preferredNodeIds?: ReadonlySet<string>,
): SessionBindingPair[] {
  const candidatesBySessionId = new Map<string, string[]>();
  for (const [nodeId, node] of Object.entries(nodes)) {
    const sessionId = node.metadata.sessionId;
    if (typeof sessionId !== 'string' || sessionId.trim().length === 0) continue;
    const existing = candidatesBySessionId.get(sessionId);
    if (existing) {
      existing.push(nodeId);
    } else {
      candidatesBySessionId.set(sessionId, [nodeId]);
    }
  }

  const pairs: SessionBindingPair[] = [];
  for (const [sessionId, candidates] of candidatesBySessionId) {
    pairs.push({ sessionId, nodeId: pickCanonicalNode(candidates, preferredNodeIds) });
  }
  return pairs;
}

function pickCanonicalNode(
  candidates: string[],
  preferredNodeIds: ReadonlySet<string> | undefined,
): string {
  if (preferredNodeIds) {
    for (const nodeId of candidates) {
      if (preferredNodeIds.has(nodeId)) return nodeId;
    }
  }
  return [...candidates].sort()[0];
}
