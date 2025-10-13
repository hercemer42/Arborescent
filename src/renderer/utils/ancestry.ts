import { TreeNode } from '../../shared/types';

export type AncestorRegistry = Record<string, string[]>;

export function buildAncestorRegistry(
  rootId: string,
  nodes: Record<string, TreeNode>
): AncestorRegistry {
  const registry: AncestorRegistry = {};

  function traverse(nodeId: string, ancestors: string[]) {
    registry[nodeId] = ancestors;
    const node = nodes[nodeId];
    if (node && node.children.length > 0) {
      const childAncestors = [...ancestors, nodeId];
      for (const childId of node.children) {
        traverse(childId, childAncestors);
      }
    }
  }

  traverse(rootId, []);
  return registry;
}

export function isDescendant(
  parentId: string,
  targetId: string | null,
  ancestorRegistry: AncestorRegistry
): boolean {
  if (!targetId) return false;
  return ancestorRegistry[targetId]?.includes(parentId) ?? false;
}
