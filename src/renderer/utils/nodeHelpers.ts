import { TreeNode, NodeStatus } from '../../shared/types';
import { AncestorRegistry } from '../services/ancestry';
import { v4 as uuidv4 } from 'uuid';
import { exportNodeAsMarkdown, exportContextAsMarkdown } from './markdown';

/**
 * Check if a resolved date falls within the given range.
 * Both bounds are inclusive. If a bound is null, it's treated as unbounded.
 */
function isResolvedInRange(
  resolvedAt: string | undefined,
  dateFrom: string | null,
  dateTo: string | null
): boolean {
  if (!resolvedAt) return false;
  const date = resolvedAt.split('T')[0];
  if (dateFrom && date < dateFrom) return false;
  if (dateTo && date > dateTo) return false;
  return true;
}

/**
 * Compute the set of node IDs visible in summary mode.
 * Includes resolved nodes within date range and all their ancestors.
 */
export function computeSummaryVisibleNodeIds(
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  ancestorRegistry: AncestorRegistry,
  dateFrom: string | null,
  dateTo: string | null
): Set<string> {
  const visibleIds = new Set<string>();

  for (const [nodeId, node] of Object.entries(nodes)) {
    const status = node.metadata.status as NodeStatus | undefined;
    const resolvedAt = node.metadata.resolvedAt as string | undefined;

    if ((status === 'completed' || status === 'abandoned') &&
        isResolvedInRange(resolvedAt, dateFrom, dateTo)) {
      visibleIds.add(nodeId);
      const ancestors = ancestorRegistry[nodeId] || [];
      for (const ancestorId of ancestors) {
        visibleIds.add(ancestorId);
      }
    }
  }

  if (visibleIds.size > 0) {
    visibleIds.add(rootNodeId);
  }

  return visibleIds;
}

/**
 * Get ancestors from closest to furthest (reversed from registry order).
 */
function getAncestorsClosestFirst(
  nodeId: string,
  ancestorRegistry: AncestorRegistry
): string[] {
  const ancestors = ancestorRegistry[nodeId] || [];
  return ancestors.slice().reverse();
}

/**
 * Walk ancestors from closest to furthest, returning the first match.
 */
function findClosestAncestor<T>(
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

export type ContextActionType = 'execute' | 'collaborate';

function getActiveContextMetadataKey(actionType?: ContextActionType): string {
  if (actionType === 'execute') return 'activeExecuteContextId';
  if (actionType === 'collaborate') return 'activeCollaborateContextId';
  return 'activeContextId';
}

/**
 * Get the applied context ID with inheritance from blueprint ancestors.
 * Used for gutter display and as the default fallback for execute/collaborate.
 *
 * Walks ancestors looking for blueprint nodes with appliedContextId set.
 * Returns the first found applied context.
 */
export function getAppliedContextIdWithInheritance(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string | undefined {
  const node = nodes[nodeId];
  if (!node) return undefined;

  // Check node's own applied context (only if blueprint)
  if (node.metadata.isBlueprint === true) {
    const appliedId = node.metadata.appliedContextId as string | undefined;
    if (appliedId && nodes[appliedId]) {
      return appliedId;
    }
  }

  // Inherit from ancestors (closest first) - only blueprint ancestors
  for (const ancestorId of getAncestorsClosestFirst(nodeId, ancestorRegistry)) {
    const ancestor = nodes[ancestorId];
    if (!ancestor) continue;
    if (ancestor.metadata.isBlueprint !== true) continue;
    const ancestorAppliedId = ancestor.metadata.appliedContextId as string | undefined;
    if (ancestorAppliedId && nodes[ancestorAppliedId]) {
      return ancestorAppliedId;
    }
  }

  return undefined;
}

/**
 * Get the active context ID for a given action type, with ancestor inheritance.
 *
 * Fallback chain:
 * 1. Check explicit execute/collaborate context on node
 * 2. Check ancestors for explicit execute/collaborate context
 * 3. Fall back to inherited appliedContextId from blueprint ancestors
 */
export function getActiveContextIdWithInheritance(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry,
  actionType?: ContextActionType
): string | undefined {
  const node = nodes[nodeId];
  if (!node) return undefined;

  const metadataKey = getActiveContextMetadataKey(actionType);

  // Check node's own explicit selection
  const activeId = node.metadata[metadataKey] as string | undefined;
  if (activeId && nodes[activeId]) {
    return activeId;
  }

  // Inherit explicit selection from ancestors (closest first)
  for (const ancestorId of getAncestorsClosestFirst(nodeId, ancestorRegistry)) {
    const ancestor = nodes[ancestorId];
    if (!ancestor) continue;
    const ancestorActiveId = ancestor.metadata[metadataKey] as string | undefined;
    if (ancestorActiveId && nodes[ancestorActiveId]) {
      return ancestorActiveId;
    }
  }

  // Fall back to inherited applied context
  return getAppliedContextIdWithInheritance(nodeId, nodes, ancestorRegistry);
}

/**
 * Find hyperlinks within a context declaration's descendants.
 * Returns linked node IDs that exist and are not the context declaration itself.
 * Does NOT recursively resolve hyperlinks within included nodes (depth = 1).
 */
export function resolveHyperlinkedContexts(
  contextNodeId: string,
  nodes: Record<string, TreeNode>
): string[] {
  const contextNode = nodes[contextNodeId];
  if (!contextNode) return [];

  const result: string[] = [];
  const descendantIds = getAllDescendants(contextNodeId, nodes);

  for (const descendantId of descendantIds) {
    const descendant = nodes[descendantId];
    if (!descendant) continue;

    // Check if descendant is a hyperlink
    if (descendant.metadata.isHyperlink === true) {
      const linkedNodeId = descendant.metadata.linkedNodeId as string | undefined;
      if (!linkedNodeId) continue;

      // Skip if linked node doesn't exist
      if (!nodes[linkedNodeId]) continue;

      // Skip if linked node is the current context declaration (circular reference)
      if (linkedNodeId === contextNodeId) continue;

      // Add the linked node if not already included
      if (!result.includes(linkedNodeId)) {
        result.push(linkedNodeId);
      }
    }
  }

  return result;
}

/**
 * Get all contexts to send for collaboration/execution.
 *
 * Returns the active context ID for the given action type, using inheritance from ancestors.
 * Hyperlinked content within the context is resolved during export (see exportContextAsMarkdown).
 * Works the same for all nodes (including context declarations).
 */
export function getContextsForCollaboration(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry,
  actionType?: ContextActionType
): string[] {
  const node = nodes[nodeId];
  if (!node) return [];

  const activeContextId = getActiveContextIdWithInheritance(nodeId, nodes, ancestorRegistry, actionType);
  if (!activeContextId) {
    return [];
  }

  return [activeContextId];
}

/**
 * Build the content to send for collaboration or execution.
 *
 * Combines context prefix (from selected contexts) with the node content.
 * Context content is exported with hyperlinks resolved inline (preserving tree order).
 * Used by both collaborate and execute actions.
 */
export function buildContentWithContext(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry,
  actionType?: ContextActionType
): { contextPrefix: string; nodeContent: string } {
  const node = nodes[nodeId];
  if (!node) return { contextPrefix: '', nodeContent: '' };

  const nodeContent = exportNodeAsMarkdown(node, nodes);

  let contextPrefix = '';
  const contextIds = getContextsForCollaboration(nodeId, nodes, ancestorRegistry, actionType);
  for (const contextId of contextIds) {
    const contextNode = nodes[contextId];
    if (contextNode) {
      // Use exportContextAsMarkdown to resolve hyperlinks in tree order
      contextPrefix += exportContextAsMarkdown(contextNode, nodes, 0, contextId) + '\n';
    }
  }

  return { contextPrefix, nodeContent };
}

/**
 * Find the node itself or closest ancestor with a metadata flag set to true.
 */
export function findClosestAncestorWithMetadata(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry,
  metadataKey: string
): string | null {
  const node = nodes[nodeId];
  if (node?.metadata[metadataKey] === true) {
    return nodeId;
  }

  const ancestorId = findClosestAncestor(nodeId, nodes, ancestorRegistry, (ancestor) =>
    ancestor.metadata[metadataKey] === true ? ancestor.id : undefined
  );

  return ancestorId || null;
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

/**
 * Get the next sibling ID of a node (sibling immediately after it).
 * Returns null if the node has no next sibling.
 */
export function getNextSiblingId(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  ancestorRegistry: Record<string, string[]>
): string | null {
  const parentResult = getParentNode(nodeId, { ancestorRegistry, rootNodeId, nodes });
  if (!parentResult) return null;

  const { parent } = parentResult;
  const siblingIndex = parent.children.indexOf(nodeId);

  if (siblingIndex >= 0 && siblingIndex < parent.children.length - 1) {
    return parent.children[siblingIndex + 1];
  }

  return null;
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

/**
 * Get a node and all its descendants (node itself included).
 * Unlike getAllDescendants, this includes the root nodes in the result.
 */
export function getNodeAndDescendantIds(
  rootIds: string[],
  nodes: Record<string, TreeNode>
): string[] {
  const result: string[] = [];
  for (const rootId of rootIds) {
    if (nodes[rootId]) {
      result.push(rootId);
      result.push(...getAllDescendants(rootId, nodes));
    }
  }
  return result;
}

/**
 * Get the parent ID for a node from the ancestor registry.
 * Returns rootNodeId if node has no ancestors.
 */
export function getParentId(
  nodeId: string,
  ancestorRegistry: AncestorRegistry,
  rootNodeId: string
): string {
  const ancestors = ancestorRegistry[nodeId] || [];
  return ancestors[ancestors.length - 1] || rootNodeId;
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
      icon: (node.metadata.blueprintIcon as string) || 'lightbulb',
    }))
    .sort((a, b) => a.content.localeCompare(b.content));
}

/**
 * Get the context declaration ID for a node.
 * Returns the node's own ID if it's a context declaration,
 * the nearest ancestor context declaration ID if it's a context child,
 * or undefined if the node is not part of a context tree.
 */
export function getContextDeclarationId(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string | undefined {
  const node = nodes[nodeId];
  if (!node) return undefined;

  if (node.metadata.isContextDeclaration === true) {
    return node.id;
  }

  // Find nearest ancestor that is a context declaration
  // ancestorRegistry[nodeId] has immediate parent at index 0, furthest at end
  const ancestors = ancestorRegistry[nodeId] || [];
  for (let i = 0; i < ancestors.length; i++) {
    const ancestor = nodes[ancestors[i]];
    if (ancestor?.metadata.isContextDeclaration === true) {
      return ancestors[i];
    }
  }
  return undefined;
}

/**
 * Check if a node is a context child by looking for a context declaration ancestor.
 * Returns true if any ancestor has isContextDeclaration.
 */
export function getIsContextChild(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): boolean {
  const node = nodes[nodeId];
  if (!node || node.metadata.isContextDeclaration) return false;

  const ancestors = ancestorRegistry[nodeId] || [];
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = nodes[ancestors[i]];
    if (ancestor?.metadata.isContextDeclaration) {
      return true;
    }
  }
  return false;
}

/**
 * Get inherited blueprint icon and color from the nearest ancestor with a blueprintIcon.
 * Returns undefined if node has its own icon or no ancestor has an icon.
 */
export function getInheritedBlueprintIcon(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): { icon: string; color: string | undefined } | undefined {
  const node = nodes[nodeId];
  if (!node || node.metadata.blueprintIcon) return undefined;

  const ancestors = ancestorRegistry[nodeId] || [];
  // Walk from nearest to furthest ancestor
  for (let i = ancestors.length - 1; i >= 0; i--) {
    const ancestor = nodes[ancestors[i]];
    if (ancestor?.metadata.blueprintIcon) {
      return {
        icon: ancestor.metadata.blueprintIcon as string,
        color: ancestor.metadata.blueprintColor as string | undefined,
      };
    }
  }
  return undefined;
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
