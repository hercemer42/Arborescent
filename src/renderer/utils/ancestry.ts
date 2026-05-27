import { TreeNode } from '../../shared/types';
import { logger } from '../services/logger';

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

/**
 * Compares a LIVE (incrementally-maintained) ancestorRegistry against a fresh
 * rebuild from `children`, logging any divergence. Unlike the prior helper —
 * which only ever ran against a just-built registry and so could never detect
 * drift — this is meant to be called with the registry currently in the store,
 * right after an incremental structural update. `children` is authoritative;
 * the registry is the denormalized cache, so any mismatch means the cache
 * drifted and the renderer (children) and logic (registry) will disagree.
 *
 * Returns true when consistent, false when any divergence was found.
 */
export function checkRegistryConsistency(
  rootNodeId: string,
  nodes: Record<string, TreeNode>,
  liveRegistry: AncestorRegistry,
  context = 'unknown',
): boolean {
  const freshRegistry = buildAncestorRegistry(rootNodeId, nodes);

  const registryKeys = new Set(Object.keys(liveRegistry));
  const freshKeys = new Set(Object.keys(freshRegistry));
  let consistent = true;

  for (const key of freshKeys) {
    if (!registryKeys.has(key)) {
      consistent = false;
      logger.warn(`registry-drift [${context}] missing node in live registry: ${key}`, 'AncestorRegistry');
    }
  }

  for (const key of registryKeys) {
    if (!freshKeys.has(key)) {
      consistent = false;
      logger.warn(`registry-drift [${context}] stale node in live registry: ${key}`, 'AncestorRegistry');
    }
  }

  for (const [nodeId, ancestors] of Object.entries(freshRegistry)) {
    const currentAncestors = liveRegistry[nodeId];
    if (!currentAncestors) continue;

    if (ancestors.length !== currentAncestors.length ||
        !ancestors.every((a, i) => a === currentAncestors[i])) {
      consistent = false;
      logger.warn(
        `registry-drift [${context}] ancestor mismatch for ${nodeId}: children-derived [${ancestors.join(', ')}] vs live [${currentAncestors.join(', ')}]`,
        'AncestorRegistry'
      );
    }
  }

  return consistent;
}

export function updateAncestorRegistry(
  rootNodeId: string,
  nodes: Record<string, TreeNode>
): { nodes: Record<string, TreeNode>; ancestorRegistry: AncestorRegistry } {
  const ancestorRegistry = buildAncestorRegistry(rootNodeId, nodes);
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

export function getAncestorsClosestFirst(
  nodeId: string,
  ancestorRegistry: AncestorRegistry
): string[] {
  const ancestors = ancestorRegistry[nodeId] || [];
  return ancestors.slice().reverse();
}

/**
 * Walk ancestors closest-first. For each ancestor, call `predicate`; the
 * first non-undefined result wins. Returns undefined if no ancestor matches.
 *
 * Centralized so callers don't re-inline the reverse-index loop.
 */
export function findClosestAncestor<T>(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry,
  predicate: (ancestor: TreeNode) => T | undefined
): T | undefined {
  for (const ancestorId of getAncestorsClosestFirst(nodeId, ancestorRegistry)) {
    const ancestor = nodes[ancestorId];
    if (!ancestor) continue;
    const result = predicate(ancestor);
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
}
