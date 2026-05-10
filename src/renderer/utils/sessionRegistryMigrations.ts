import type { TreeNode } from '../../shared/types';

const DROPPED_FIELDS = [
  'sessionLiveness',
  'sessionTabId',
  'sessionStarting',
  'sessionLost',
  'sessionWorkingDirectory',
] as const;

export function stripDroppedSessionFields(
  nodes: Record<string, TreeNode>,
): Record<string, TreeNode> {
  let migrated: Record<string, TreeNode> | null = null;

  for (const [id, node] of Object.entries(nodes)) {
    const hasDropped = DROPPED_FIELDS.some(
      (field) => Object.prototype.hasOwnProperty.call(node.metadata, field),
    );
    if (!hasDropped) continue;

    if (!migrated) migrated = { ...nodes };
    const cleaned = { ...node.metadata };
    for (const field of DROPPED_FIELDS) delete cleaned[field];
    migrated[id] = { ...node, metadata: cleaned };
  }

  return migrated ?? nodes;
}

export function garbageCollectSessionRegistry(
  nodes: Record<string, TreeNode>,
  registry: Record<string, { cwd: string }>,
): Record<string, { cwd: string }> {
  if (Object.keys(registry).length === 0) return registry;

  const referencedIds = new Set<string>();
  for (const node of Object.values(nodes)) {
    const id = node.metadata.sessionId;
    if (typeof id === 'string' && id.length > 0) referencedIds.add(id);
  }

  let cleaned: Record<string, { cwd: string }> | null = null;
  for (const key of Object.keys(registry)) {
    if (!referencedIds.has(key)) {
      if (!cleaned) cleaned = { ...registry };
      delete cleaned[key];
    }
  }

  return cleaned ?? registry;
}
