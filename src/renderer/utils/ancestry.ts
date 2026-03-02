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

export function addNodeToRegistry(
  registry: AncestorRegistry,
  nodeId: string,
  parentId: string
): AncestorRegistry {
  const parentAncestors = registry[parentId] || [];
  return {
    ...registry,
    [nodeId]: [...parentAncestors, parentId],
  };
}

export function removeNodeFromRegistry(
  registry: AncestorRegistry,
  nodeId: string,
  nodes: Record<string, TreeNode>
): AncestorRegistry {
  const newRegistry = { ...registry };

  function removeRecursively(id: string) {
    delete newRegistry[id];
    const node = nodes[id];
    if (node) {
      for (const childId of node.children) {
        removeRecursively(childId);
      }
    }
  }

  removeRecursively(nodeId);
  return newRegistry;
}

export function moveNodeInRegistry(
  registry: AncestorRegistry,
  nodeId: string,
  newParentId: string,
  nodes: Record<string, TreeNode>
): AncestorRegistry {
  const newRegistry = { ...registry };
  const newParentAncestors = registry[newParentId] || [];
  const newAncestors = [...newParentAncestors, newParentId];

  function updateRecursively(id: string, ancestors: string[]) {
    newRegistry[id] = ancestors;
    const node = nodes[id];
    if (node) {
      const childAncestors = [...ancestors, id];
      for (const childId of node.children) {
        updateRecursively(childId, childAncestors);
      }
    }
  }

  updateRecursively(nodeId, newAncestors);
  return newRegistry;
}

export function addNodesToRegistry(
  registry: AncestorRegistry,
  rootNodeIds: string[],
  parentId: string,
  nodes: Record<string, TreeNode>
): AncestorRegistry {
  const newRegistry = { ...registry };
  const parentAncestors = registry[parentId] || [];
  const baseAncestors = [...parentAncestors, parentId];

  function addRecursively(nodeId: string, ancestors: string[]) {
    newRegistry[nodeId] = ancestors;
    const node = nodes[nodeId];
    if (node) {
      const childAncestors = [...ancestors, nodeId];
      for (const childId of node.children) {
        addRecursively(childId, childAncestors);
      }
    }
  }

  for (const rootId of rootNodeIds) {
    addRecursively(rootId, baseAncestors);
  }

  return newRegistry;
}

function validateAncestorRegistry(
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  ancestorRegistry: AncestorRegistry
): void {
  if (process.env.NODE_ENV === 'production') return;

  const freshRegistry = buildAncestorRegistry(rootNodeId, nodes);

  const registryKeys = new Set(Object.keys(ancestorRegistry));
  const freshKeys = new Set(Object.keys(freshRegistry));

  for (const key of freshKeys) {
    if (!registryKeys.has(key)) {
      console.error(`[AncestorRegistry] Missing node in registry: ${key}`);
    }
  }

  for (const key of registryKeys) {
    if (!freshKeys.has(key)) {
      console.error(`[AncestorRegistry] Stale node in registry: ${key}`);
    }
  }

  for (const [nodeId, ancestors] of Object.entries(freshRegistry)) {
    const currentAncestors = ancestorRegistry[nodeId];
    if (!currentAncestors) continue;

    if (ancestors.length !== currentAncestors.length ||
        !ancestors.every((a, i) => a === currentAncestors[i])) {
      console.error(
        `[AncestorRegistry] Ancestor mismatch for ${nodeId}:`,
        `expected [${ancestors.join(', ')}]`,
        `got [${currentAncestors.join(', ')}]`
      );
    }
  }
}

export function updateAncestorRegistry(
  rootNodeId: string,
  nodes: Record<string, TreeNode>
): { nodes: Record<string, TreeNode>; ancestorRegistry: AncestorRegistry } {
  const ancestorRegistry = buildAncestorRegistry(rootNodeId, nodes);

  validateAncestorRegistry(nodes, rootNodeId, ancestorRegistry);

  return { nodes, ancestorRegistry };
}

export function isDescendant(
  parentId: string,
  targetId: string | null,
  ancestorRegistry: AncestorRegistry
): boolean {
  if (!targetId) return false;
  return ancestorRegistry[targetId]?.includes(parentId) ?? false;
}
