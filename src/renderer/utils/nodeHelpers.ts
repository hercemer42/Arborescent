import { TreeNode, NodeStatus } from '../../shared/types';
import { AncestorRegistry } from '../services/ancestry';
import { v4 as uuidv4 } from 'uuid';
import { exportNodeAsMarkdown, exportContextAsMarkdown } from './markdown';

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

function getAncestorsClosestFirst(
  nodeId: string,
  ancestorRegistry: AncestorRegistry
): string[] {
  const ancestors = ancestorRegistry[nodeId] || [];
  return ancestors.slice().reverse();
}

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

export function getAppliedContextIdWithInheritance(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string | undefined {
  const node = nodes[nodeId];
  if (!node) return undefined;

  const appliedId = node.metadata.appliedContextId as string | undefined;
  if (appliedId && nodes[appliedId]) {
    return appliedId;
  }

  return getInheritedContextId(nodeId, nodes, ancestorRegistry);
}

export function getInheritedContextId(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string | undefined {
  for (const ancestorId of getAncestorsClosestFirst(nodeId, ancestorRegistry)) {
    const ancestor = nodes[ancestorId];
    if (!ancestor) continue;
    const ancestorAppliedId = ancestor.metadata.appliedContextId as string | undefined;
    if (ancestorAppliedId && nodes[ancestorAppliedId]) {
      return ancestorAppliedId;
    }
  }
  return undefined;
}

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

    if (descendant.metadata.isHyperlink === true) {
      const linkedNodeId = descendant.metadata.linkedNodeId as string | undefined;
      if (!linkedNodeId) continue;
      if (!nodes[linkedNodeId]) continue;
      if (linkedNodeId === contextNodeId) continue;
      if (!result.includes(linkedNodeId)) {
        result.push(linkedNodeId);
      }
    }
  }

  return result;
}

export function getContextsForCollaboration(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string[] {
  const node = nodes[nodeId];
  if (!node) return [];

  const activeContextId = getAppliedContextIdWithInheritance(nodeId, nodes, ancestorRegistry);
  if (!activeContextId) {
    return [];
  }

  return [activeContextId];
}

export function buildContentWithContext(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): { contextPrefix: string; nodeContent: string } {
  const node = nodes[nodeId];
  if (!node) return { contextPrefix: '', nodeContent: '' };

  const nodeContent = exportNodeAsMarkdown(node, nodes);

  let contextPrefix = '';
  const contextIds = getContextsForCollaboration(nodeId, nodes, ancestorRegistry);
  for (const contextId of contextIds) {
    const contextNode = nodes[contextId];
    if (contextNode) {
        contextPrefix += exportContextAsMarkdown(contextNode, nodes, 0, contextId) + '\n';
    }
  }

  return { contextPrefix, nodeContent };
}

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

export function sortNodeIdsByTreeOrder(
  nodeIds: string[],
  rootNodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: Record<string, string[]>
): string[] {
  if (nodeIds.length <= 1) return nodeIds;

  const nodeIdSet = new Set(nodeIds);
  const orderedNodes = getVisibleNodesInOrder(rootNodeId, nodes, ancestorRegistry);

  return orderedNodes.filter(id => nodeIdSet.has(id));
}

export interface CreateTreeNodeOptions {
  content?: string;
  children?: string[];
  metadata?: Record<string, unknown>;
}

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

export function isValidDrop(
  nodeId: string,
  targetNodeId: string,
  dropZone: DropZone,
  nodesToMove: string[],
  ancestorRegistry: AncestorRegistry
): boolean {
  if (nodeId === targetNodeId) {
    return false;
  }

  const targetAncestors = ancestorRegistry[targetNodeId] || [];
  if (targetAncestors.includes(nodeId)) {
    return false;
  }

  if (dropZone !== 'child' && nodesToMove.includes(targetNodeId)) {
    return false;
  }

  return true;
}

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

  const ancestors = ancestorRegistry[nodeId] || [];
  for (let i = 0; i < ancestors.length; i++) {
    const ancestor = nodes[ancestors[i]];
    if (ancestor?.metadata.isContextDeclaration === true) {
      return ancestors[i];
    }
  }
  return undefined;
}

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

export function shouldInheritBlueprint(
  parentId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): boolean {
  const parent = nodes[parentId];
  if (!parent) return false;
  return parent.metadata.isContextDeclaration === true || getIsContextChild(parentId, nodes, ancestorRegistry);
}

export function getInheritedBlueprintIcon(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): { icon: string; color: string | undefined } | undefined {
  const node = nodes[nodeId];
  if (!node || node.metadata.blueprintIcon) return undefined;

  const ancestors = ancestorRegistry[nodeId] || [];
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

function cloneNodeTreeRecursive(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  idMapping: Record<string, string>,
  newNodesMap: Record<string, TreeNode>
): void {
  const node = nodes[nodeId];
  if (!node || idMapping[nodeId]) return;

  const newId = uuidv4();
  idMapping[nodeId] = newId;

  for (const childId of node.children) {
    cloneNodeTreeRecursive(childId, nodes, idMapping, newNodesMap);
  }

  const clonedNode: TreeNode = {
    ...structuredClone(node),
    id: newId,
    children: node.children.map((childId) => idMapping[childId] || childId),
  };
  newNodesMap[newId] = clonedNode;
}

export function cloneNodesWithNewIds(
  rootNodeIds: string[],
  nodes: Record<string, TreeNode>
): { newRootNodes: TreeNode[]; newNodesMap: Record<string, TreeNode> } {
  const idMapping: Record<string, string> = {};
  const newNodesMap: Record<string, TreeNode> = {};

  for (const rootId of rootNodeIds) {
    cloneNodeTreeRecursive(rootId, nodes, idMapping, newNodesMap);
  }

  const newRootNodes = rootNodeIds
    .map((oldId) => newNodesMap[idMapping[oldId]])
    .filter(Boolean);

  return { newRootNodes, newNodesMap };
}
