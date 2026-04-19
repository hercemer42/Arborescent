import { TreeNode } from '../../shared/types';
import { AncestorRegistry } from './ancestry';
import { getParentId } from './parentLookup';

/**
 * Visible-tree navigation primitives. These operate on the expanded/
 * collapsed view of the tree (respecting `metadata.expanded`) and return
 * the next or previous node the user would land on when moving with the
 * arrow keys.
 *
 * Parent lookup is delegated to nodeHelpers.getParentId; descendant-
 * traversal / tree-construction helpers live in nodeHelpers.
 */

export function findPreviousNode(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  ancestorRegistry: Record<string, string[]>
): string | null {
  const parentId = getParentId(nodeId, ancestorRegistry, rootNodeId);
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
    const parentId = getParentId(currentId, ancestorRegistry, rootNodeId);
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
  const parentId = getParentId(nodeId, ancestorRegistry, rootNodeId);
  const parent = nodes[parentId];
  if (!parent) return null;

  const siblingIndex = parent.children.indexOf(nodeId);

  if (siblingIndex >= 0 && siblingIndex < parent.children.length - 1) {
    return parent.children[siblingIndex + 1];
  }

  return null;
}

export function captureNodePosition(
  nodeId: string,
  state: { nodes: Record<string, TreeNode>; ancestorRegistry: Record<string, string[]>; rootNodeId: string }
): { parentId: string; originalPosition: number } {
  const { nodes, ancestorRegistry, rootNodeId } = state;
  const parentId = getParentId(nodeId, ancestorRegistry, rootNodeId);
  const parent = nodes[parentId];
  const originalPosition = parent ? parent.children.indexOf(nodeId) : -1;
  return { parentId, originalPosition };
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

// Re-export AncestorRegistry type so callers that migrate off
// nodeHelpers can import everything they need from here.
export type { AncestorRegistry };
