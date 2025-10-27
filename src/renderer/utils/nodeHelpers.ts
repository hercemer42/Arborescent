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

  const visibleSiblings = getVisibleChildren(parent.children, nodes);
  const siblingIndex = visibleSiblings.indexOf(nodeId);
  if (siblingIndex > 0) {
    const prevSiblingId = visibleSiblings[siblingIndex - 1];
    let deepestId = prevSiblingId;
    let deepestNode = nodes[deepestId];

    while (deepestNode && (deepestNode.metadata.expanded ?? true)) {
      const visibleChildren = getVisibleChildren(deepestNode.children, nodes);
      if (visibleChildren.length === 0) break;
      deepestId = visibleChildren[visibleChildren.length - 1];
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

  if ((node.metadata.expanded ?? true)) {
    const visibleChildren = getVisibleChildren(node.children, nodes);
    if (visibleChildren.length > 0) {
      return visibleChildren[0];
    }
  }

  let currentId = nodeId;

  while (currentId !== rootNodeId) {
    const ancestors = ancestorRegistry[currentId] || [];
    const parentId = ancestors[ancestors.length - 1] || rootNodeId;
    const parent = nodes[parentId];
    if (!parent) return null;

    const visibleSiblings = getVisibleChildren(parent.children, nodes);
    const siblingIndex = visibleSiblings.indexOf(currentId);
    if (siblingIndex < visibleSiblings.length - 1) {
      return visibleSiblings[siblingIndex + 1];
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
