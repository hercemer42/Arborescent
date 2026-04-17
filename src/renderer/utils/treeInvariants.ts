import type { TreeNode } from '../../shared/types';

export function findAllParentsOf(
  nodes: Record<string, TreeNode>,
  nodeId: string,
): string[] {
  const parents: string[] = [];
  for (const parent of Object.values(nodes)) {
    if (parent.id !== nodeId && parent.children.includes(nodeId)) {
      parents.push(parent.id);
    }
  }
  return parents;
}

export function removeNodeFromAllParents(
  nodes: Record<string, TreeNode>,
  nodeId: string,
): Record<string, TreeNode> {
  const parentIds = findAllParentsOf(nodes, nodeId);
  if (parentIds.length === 0) return nodes;

  const updated = { ...nodes };
  for (const parentId of parentIds) {
    updated[parentId] = {
      ...updated[parentId],
      children: updated[parentId].children.filter((id) => id !== nodeId),
    };
  }
  return updated;
}

export interface DuplicateChildReference {
  nodeId: string;
  parentIds: string[];
}

export function findDuplicateChildReferences(
  nodes: Record<string, TreeNode>,
): DuplicateChildReference[] {
  const parentsByChild = new Map<string, string[]>();

  for (const parent of Object.values(nodes)) {
    for (const childId of parent.children) {
      if (childId === parent.id) continue;
      if (!nodes[childId]) continue;
      const parents = parentsByChild.get(childId) ?? [];
      parents.push(parent.id);
      parentsByChild.set(childId, parents);
    }
  }

  const duplicates: DuplicateChildReference[] = [];
  for (const [nodeId, parentIds] of parentsByChild.entries()) {
    if (parentIds.length > 1) {
      duplicates.push({ nodeId, parentIds });
    }
  }
  return duplicates;
}

export interface ReconcileDuplicatesResult {
  nodes: Record<string, TreeNode>;
  removed: Array<{ nodeId: string; removedFrom: string }>;
}

export function reconcileDuplicateChildren(
  nodes: Record<string, TreeNode>,
): ReconcileDuplicatesResult {
  const seen = new Set<string>();
  const updated: Record<string, TreeNode> = {};
  const removed: Array<{ nodeId: string; removedFrom: string }> = [];
  let anyChanged = false;

  for (const [id, node] of Object.entries(nodes)) {
    let nodeChanged = false;
    const keptChildren: string[] = [];
    for (const childId of node.children) {
      if (seen.has(childId)) {
        removed.push({ nodeId: childId, removedFrom: id });
        nodeChanged = true;
        continue;
      }
      seen.add(childId);
      keptChildren.push(childId);
    }
    if (nodeChanged) {
      updated[id] = { ...node, children: keptChildren };
      anyChanged = true;
    } else {
      updated[id] = node;
    }
  }

  return { nodes: anyChanged ? updated : nodes, removed };
}
