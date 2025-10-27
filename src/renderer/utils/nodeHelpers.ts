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

export function findPreviousVisibleNode(
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

    while (deepestNode && (deepestNode.metadata.expanded ?? true) && deepestNode.children.length > 0) {
      deepestId = deepestNode.children[deepestNode.children.length - 1];
      deepestNode = nodes[deepestId];
    }

    return deepestId;
  }

  return parentId === rootNodeId ? null : parentId;
}

export function findNextVisibleNode(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  ancestorRegistry: Record<string, string[]>
): string | null {
  const node = nodes[nodeId];
  if (!node) return null;

  if ((node.metadata.expanded ?? true) && node.children.length > 0) {
    return node.children[0];
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

export function getVisibleChildren(
  childrenIds: string[],
  nodes: Record<string, TreeNode>
): string[] {
  return childrenIds.filter((childId) => !nodes[childId]?.metadata.deleted);
}

export function calculateNextSelectedNode(
  deletedNodeIndex: number,
  remainingSiblings: string[],
  parentId: string,
  rootNodeId: string
): string | null {
  if (remainingSiblings.length === 0) {
    return parentId === rootNodeId ? null : parentId;
  }

  if (deletedNodeIndex < remainingSiblings.length) {
    return remainingSiblings[deletedNodeIndex];
  }

  return remainingSiblings[remainingSiblings.length - 1];
}

export function calculateNextSelection(
  nodeId: string,
  parentId: string,
  rootNodeId: string,
  parent: TreeNode,
  nodes: Record<string, TreeNode>
): string | null {
  const visibleSiblings = parent.children.filter((id) => !nodes[id]?.metadata.deleted);
  const visibleIndex = visibleSiblings.indexOf(nodeId);
  return calculateNextSelectedNode(visibleIndex, visibleSiblings, parentId, rootNodeId);
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
