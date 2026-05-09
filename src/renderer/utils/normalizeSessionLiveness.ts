import type { TreeNode } from '../../shared/types';

export function normalizeSessionLiveness(
  nodes: Record<string, TreeNode>,
): Record<string, TreeNode> {
  let migrated: Record<string, TreeNode> | null = null;

  for (const [id, node] of Object.entries(nodes)) {
    const { sessionId, sessionLiveness, sessionStarting } = node.metadata;

    const hasInFlightStart = sessionStarting === true && !sessionId;
    const wasOnDiskAttached = sessionLiveness === 'alive-attached';

    if (!hasInFlightStart && !wasOnDiskAttached) continue;

    if (!migrated) migrated = { ...nodes };

    const cleanedMetadata = { ...node.metadata };
    if (hasInFlightStart) {
      cleanedMetadata.sessionLiveness = 'lost';
      delete cleanedMetadata.sessionStarting;
    } else if (wasOnDiskAttached) {
      cleanedMetadata.sessionLiveness = 'alive-detached';
    }

    migrated[id] = { ...node, metadata: cleanedMetadata };
  }

  return migrated ?? nodes;
}
