import { TreeNode } from '../../shared/types';
import { AncestorRegistry } from '../services/ancestry';
import { v4 as uuidv4 } from 'uuid';

/**
 * Find the effective context for a node - its own appliedContextId
 * or the closest one found in its ancestor chain.
 *
 * @returns The context node ID, or null if no context is applied
 */
export function getEffectiveContextId(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string | null {
  const node = nodes[nodeId];
  if (!node) return null;

  // Check node's own applied context first
  if (node.metadata.appliedContextId) {
    return node.metadata.appliedContextId as string;
  }

  // Walk up ancestors from closest to furthest
  const ancestors = ancestorRegistry[nodeId] || [];
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestorId = ancestors[i];
    const ancestor = nodes[ancestorId];
    if (ancestor?.metadata.appliedContextId) {
      return ancestor.metadata.appliedContextId as string;
    }
  }

  return null;
}

export function updateNodeMetadata(
  nodes: Record<string, TreeNode>,
  nodeId: string,
  metadataUpdates: Partial<TreeNode['metadata']>
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;

  return {
    ...nodes,
    [nodeId]: {
      ...node,
      metadata: {
        ...node.metadata,
        ...metadataUpdates,
      },
    },
  };
}

export function findPreviousNode(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  ancestorRegistry: Record<string, string[]>
): string | null {
  const ancestors = ancestorRegistry[nodeId] || [];
  const parentId = ancestors[ancestors.length - 1] || rootNodeId;
  const parent = nodes[parentId];
  if (!parent) return null;

  const siblingIndex = parent.children.indexOf(nodeId);
  if (siblingIndex > 0) {
    const prevSiblingId = parent.children[siblingIndex - 1];
    let deepestId = prevSiblingId;
    let deepestNode = nodes[deepestId];

    while (deepestNode && (deepestNode.metadata.expanded ?? true)) {
      if (deepestNode.children.length === 0) break;
      deepestId = deepestNode.children[deepestNode.children.length - 1];
      deepestNode = nodes[deepestId];
    }

    return deepestId;
  }

  return parentId === rootNodeId ? null : parentId;
}

export function findNextNode(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  ancestorRegistry: Record<string, string[]>
): string | null {
  const node = nodes[nodeId];
  if (!node) return null;

  if ((node.metadata.expanded ?? true)) {
    if (node.children.length > 0) {
      return node.children[0];
    }
  }

  let currentId = nodeId;

  while (currentId !== rootNodeId) {
    const ancestors = ancestorRegistry[currentId] || [];
    const parentId = ancestors[ancestors.length - 1] || rootNodeId;
    const parent = nodes[parentId];
    if (!parent) return null;

    const siblingIndex = parent.children.indexOf(currentId);
    if (siblingIndex < parent.children.length - 1) {
      return parent.children[siblingIndex + 1];
    }

    if (parentId === rootNodeId) return null;

    currentId = parentId;
  }

  return null;
}

export function isLastRootLevelNode(
  parentId: string,
  rootNodeId: string,
  parent: TreeNode
): boolean {
  return parentId === rootNodeId && parent.children.length === 1;
}

export function getParentNode(
  nodeId: string,
  state: { ancestorRegistry: Record<string, string[]>; rootNodeId: string; nodes: Record<string, TreeNode> }
): { parentId: string; parent: TreeNode } | null {
  const { ancestorRegistry, rootNodeId, nodes } = state;
  const ancestors = ancestorRegistry[nodeId] || [];
  const parentId = ancestors[ancestors.length - 1] || rootNodeId;
  const parent = nodes[parentId];

  if (!parent) return null;

  return { parentId, parent };
}

export function captureNodePosition(
  nodeId: string,
  state: { nodes: Record<string, TreeNode>; ancestorRegistry: Record<string, string[]>; rootNodeId: string }
): { parentId: string; originalPosition: number } {
  const { nodes, ancestorRegistry, rootNodeId } = state;
  const ancestors = ancestorRegistry[nodeId] || [];
  const parentId = ancestors[ancestors.length - 1] || rootNodeId;
  const parent = nodes[parentId];
  const originalPosition = parent ? parent.children.indexOf(nodeId) : -1;
  return { parentId, originalPosition };
}

export function getAllDescendants(nodeId: string, nodes: Record<string, TreeNode>): string[] {
  const node = nodes[nodeId];
  if (!node || node.children.length === 0) {
    return [];
  }

  const descendants: string[] = [];
  for (const childId of node.children) {
    descendants.push(childId);
    descendants.push(...getAllDescendants(childId, nodes));
  }
  return descendants;
}

export function getVisibleNodesInOrder(
  rootNodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: Record<string, string[]>
): string[] {
  const rootNode = nodes[rootNodeId];
  if (!rootNode || rootNode.children.length === 0) {
    return [];
  }

  const result: string[] = [];
  let currentId: string | null = rootNode.children[0];

  while (currentId) {
    result.push(currentId);
    currentId = findNextNode(currentId, nodes, rootNodeId, ancestorRegistry);
  }

  return result;
}

/**
 * Sort an array of node IDs by their order in the tree.
 * Uses depth-first traversal order (parent before children, siblings in order).
 */
export function sortNodeIdsByTreeOrder(
  nodeIds: string[],
  rootNodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: Record<string, string[]>
): string[] {
  if (nodeIds.length <= 1) return nodeIds;

  const nodeIdSet = new Set(nodeIds);
  const orderedNodes = getVisibleNodesInOrder(rootNodeId, nodes, ancestorRegistry);

  // Filter to only include the requested node IDs, preserving tree order
  return orderedNodes.filter(id => nodeIdSet.has(id));
}

/**
 * Options for creating a tree node
 */
export interface CreateTreeNodeOptions {
  content?: string;
  children?: string[];
  metadata?: Record<string, unknown>;
}

/**
 * Create a new TreeNode with sensible defaults.
 * Centralizes node creation to ensure consistent structure.
 *
 * @param id - Unique identifier for the node
 * @param options - Optional content, children, and metadata
 * @returns A new TreeNode
 */
export function createTreeNode(
  id: string,
  options: CreateTreeNodeOptions = {}
): TreeNode {
  return {
    id,
    content: options.content ?? '',
    children: options.children ?? [],
    metadata: options.metadata ?? {},
  };
}

/**
 * Wrap a set of nodes with a hidden root node.
 * Used when displaying parsed content that needs an invisible container.
 *
 * @param nodes - The nodes to wrap
 * @param contentRootId - The ID of the content's root node (becomes child of hidden root)
 * @param hiddenRootId - The ID for the hidden root node
 * @returns New nodes map with hidden root, and the hidden root ID
 */
export function wrapNodesWithHiddenRoot(
  nodes: Record<string, TreeNode>,
  contentRootId: string,
  hiddenRootId: string = 'hidden-root'
): { nodes: Record<string, TreeNode>; rootNodeId: string } {
  return {
    nodes: {
      ...nodes,
      [hiddenRootId]: createTreeNode(hiddenRootId, {
        children: [contentRootId],
      }),
    },
    rootNodeId: hiddenRootId,
  };
}

export type DropZone = 'before' | 'after' | 'child';

/**
 * Check if a node has any ancestor with plugin session data.
 * Used to determine if context should inherit plugin state from parent nodes.
 */
export function hasAncestorWithPluginSession(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): boolean {
  const ancestors = ancestorRegistry[nodeId] || [];
  return ancestors.some((ancestorId) => {
    const ancestor = nodes[ancestorId];
    return ancestor && ancestor.metadata.plugins && Object.keys(ancestor.metadata.plugins).length > 0;
  });
}

/**
 * Validate whether a drag and drop operation is valid.
 * Prevents dropping a node onto itself, its descendants, or other invalid targets.
 */
export function isValidDrop(
  nodeId: string,
  targetNodeId: string,
  dropZone: DropZone,
  nodesToMove: string[],
  ancestorRegistry: AncestorRegistry
): boolean {
  // Skip if trying to drop into the node itself
  if (nodeId === targetNodeId) {
    return false;
  }

  // Skip if trying to drop into one of its descendants
  const targetAncestors = ancestorRegistry[targetNodeId] || [];
  if (targetAncestors.includes(nodeId)) {
    return false;
  }

  // Skip if target is one of the nodes being moved (when dropping as sibling)
  if (dropZone !== 'child' && nodesToMove.includes(targetNodeId)) {
    return false;
  }

  return true;
}

/**
 * Find all context declarations in the tree.
 * Returns an array of context info objects sorted by content.
 */
export function getContextDeclarations(
  nodes: Record<string, TreeNode>
): { nodeId: string; content: string; icon: string }[] {
  return Object.values(nodes)
    .filter(node => node.metadata.isContextDeclaration === true)
    .map(node => ({
      nodeId: node.id,
      content: node.content || 'Untitled context',
      icon: (node.metadata.contextIcon as string) || 'lightbulb',
    }))
    .sort((a, b) => a.content.localeCompare(b.content));
}

/**
 * Clone a node and all its descendants with new UUIDs.
 * Recursively traverses from the given node, creating deep clones with fresh IDs.
 *
 * @param nodeId - The root node ID to clone from
 * @param nodes - Map of all nodes in the tree
 * @param idMapping - Map to track old ID -> new ID mappings (mutated)
 * @param newNodesMap - Map to collect cloned nodes (mutated)
 */
function cloneNodeTreeRecursive(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  idMapping: Record<string, string>,
  newNodesMap: Record<string, TreeNode>
): void {
  const node = nodes[nodeId];
  if (!node || idMapping[nodeId]) return; // Skip if not found or already processed

  // Generate new ID
  const newId = uuidv4();
  idMapping[nodeId] = newId;

  // Recursively process children first so their IDs are in the mapping
  for (const childId of node.children) {
    cloneNodeTreeRecursive(childId, nodes, idMapping, newNodesMap);
  }

  // Clone with new ID and updated children references
  const clonedNode: TreeNode = {
    ...structuredClone(node),
    id: newId,
    children: node.children.map((childId) => idMapping[childId] || childId),
  };
  newNodesMap[newId] = clonedNode;
}

/**
 * Clone multiple node trees with new UUIDs for pasting.
 * Traverses from each root node, creating deep clones with fresh IDs.
 *
 * @param rootNodeIds - Array of root node IDs to clone
 * @param nodes - Map of all nodes in the tree
 * @returns Object with new root nodes and a map of all cloned nodes
 */
export function cloneNodesWithNewIds(
  rootNodeIds: string[],
  nodes: Record<string, TreeNode>
): { newRootNodes: TreeNode[]; newNodesMap: Record<string, TreeNode> } {
  const idMapping: Record<string, string> = {};
  const newNodesMap: Record<string, TreeNode> = {};

  // Clone each root and its descendants
  for (const rootId of rootNodeIds) {
    cloneNodeTreeRecursive(rootId, nodes, idMapping, newNodesMap);
  }

  // Get new root nodes
  const newRootNodes = rootNodeIds
    .map((oldId) => newNodesMap[idMapping[oldId]])
    .filter(Boolean);

  return { newRootNodes, newNodesMap };
}
