import { TreeNode } from '../../shared/types';

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
