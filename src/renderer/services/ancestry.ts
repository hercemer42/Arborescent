import { TreeNode } from '../../shared/types';

export type AncestorRegistry = Record<string, string[]>;

/**
 * Build the ancestor registry from scratch by traversing the tree.
 * Use this only for initial load - prefer incremental updates for mutations.
 */
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

// =============================================================================
// Incremental Update Functions
// =============================================================================

/**
 * Add a newly created node to the registry.
 * O(1) - just adds one entry.
 */
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

/**
 * Remove a node and all its descendants from the registry.
 * O(d) where d is the number of descendants.
 */
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

/**
 * Update registry after moving a node to a new parent.
 * O(d) where d is the number of descendants of the moved node.
 */
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

/**
 * Add multiple nodes (e.g., from paste) to the registry.
 * Traverses from root nodes down to set correct ancestors.
 */
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

/**
 * Validate that the ancestor registry is in sync with the nodes structure.
 * Only runs in development mode.
 */
function validateAncestorRegistry(
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  ancestorRegistry: AncestorRegistry
): void {
  if (process.env.NODE_ENV === 'production') return;

  const freshRegistry = buildAncestorRegistry(rootNodeId, nodes);

  // Check for missing or extra keys
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

  // Check for mismatched ancestors
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

/**
 * Central function to update the ancestor registry after any structural mutation.
 * This should be called after any operation that modifies the tree structure
 * (create, delete, move, paste nodes).
 *
 * @param rootNodeId - The root node ID of the tree
 * @param nodes - The updated nodes map
 * @returns Object with nodes and ancestorRegistry to spread into setState
 */
export function updateAncestorRegistry(
  rootNodeId: string,
  nodes: Record<string, TreeNode>
): { nodes: Record<string, TreeNode>; ancestorRegistry: AncestorRegistry } {
  const ancestorRegistry = buildAncestorRegistry(rootNodeId, nodes);

  // Validate in development mode
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
