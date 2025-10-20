import { TreeNode } from '../../../../shared/types';
import { AncestorRegistry, buildAncestorRegistry } from '../../../utils/ancestry';

export interface TreeStructureActions {
  indentNode: (nodeId: string) => void;
  outdentNode: (nodeId: string) => void;
  moveNodeUp: (nodeId: string) => void;
  moveNodeDown: (nodeId: string) => void;
  deleteNode: (nodeId: string, confirmed?: boolean) => boolean;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  selectedNodeId: string | null;
  cursorPosition: number;
};
type StoreSetter = (partial: Partial<StoreState>) => void;

function reparentNode(
  nodeId: string,
  oldParentId: string,
  newParentId: string,
  insertAt: 'start' | 'end' | number,
  state: StoreState
): { updatedNodes: Record<string, TreeNode>; newAncestorRegistry: AncestorRegistry } {
  const { nodes, rootNodeId } = state;
  const oldParent = nodes[oldParentId];
  const newParent = nodes[newParentId];

  const updatedOldParentChildren = oldParent.children.filter((id) => id !== nodeId);

  let updatedNewParentChildren: string[];
  if (insertAt === 'end') {
    updatedNewParentChildren = [...newParent.children, nodeId];
  } else if (insertAt === 'start') {
    updatedNewParentChildren = [nodeId, ...newParent.children];
  } else {
    updatedNewParentChildren = [...newParent.children];
    updatedNewParentChildren.splice(insertAt, 0, nodeId);
  }

  const updatedNodes = {
    ...nodes,
    [oldParentId]: {
      ...oldParent,
      children: updatedOldParentChildren,
    },
    [newParentId]: {
      ...newParent,
      children: updatedNewParentChildren,
    },
  };

  const newAncestorRegistry = buildAncestorRegistry(rootNodeId, updatedNodes);

  return { updatedNodes, newAncestorRegistry };
}

function swapSiblings(
  nodeId: string,
  parentId: string,
  currentIndex: number,
  direction: 'up' | 'down',
  nodes: Record<string, TreeNode>
): Record<string, TreeNode> {
  const parent = nodes[parentId];
  const swapIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

  const updatedChildren = [...parent.children];
  [updatedChildren[currentIndex], updatedChildren[swapIndex]] =
    [updatedChildren[swapIndex], updatedChildren[currentIndex]];

  return {
    ...nodes,
    [parentId]: {
      ...parent,
      children: updatedChildren,
    },
  };
}

function moveNodeToSiblingParent(
  nodeId: string,
  parentId: string,
  direction: 'up' | 'down',
  ancestors: string[],
  state: StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void
): void {
  const { nodes, rootNodeId } = state;
  const grandparentId = ancestors[ancestors.length - 2] || rootNodeId;
  const grandparent = nodes[grandparentId];
  if (!grandparent) return;

  const parentIndexInGrandparent = grandparent.children.indexOf(parentId);

  const canMoveToSiblingParent = direction === 'up'
    ? parentIndexInGrandparent > 0
    : parentIndexInGrandparent >= 0 && parentIndexInGrandparent < grandparent.children.length - 1;

  if (!canMoveToSiblingParent) return;

  const newParentIndex = direction === 'up'
    ? parentIndexInGrandparent - 1
    : parentIndexInGrandparent + 1;
  const newParentId = grandparent.children[newParentIndex];
  const newParent = nodes[newParentId];
  if (!newParent) return;

  const insertAt = direction === 'up' ? 'end' : 'start';
  const { updatedNodes, newAncestorRegistry } = reparentNode(
    nodeId,
    parentId,
    newParentId,
    insertAt,
    state
  );

  set({
    nodes: updatedNodes,
    ancestorRegistry: newAncestorRegistry,
  });
  triggerAutosave?.();
}

function recursivelyDeleteNode(
  nodeId: string,
  nodes: Record<string, TreeNode>
): Record<string, TreeNode> {
  const node = nodes[nodeId];
  if (!node) return nodes;

  let updatedNodes = { ...nodes };

  for (const childId of node.children) {
    updatedNodes = recursivelyDeleteNode(childId, updatedNodes);
  }

  delete updatedNodes[nodeId];

  return updatedNodes;
}

function isLastRootLevelNode(
  nodeId: string,
  parentId: string,
  rootNodeId: string,
  parent: TreeNode
): boolean {
  return parentId === rootNodeId && parent.children.length === 1;
}

function clearNodeContent(
  nodeId: string,
  node: TreeNode,
  nodes: Record<string, TreeNode>,
  set: StoreSetter,
  triggerAutosave?: () => void
): void {
  const updatedNodes = {
    ...nodes,
    [nodeId]: {
      ...node,
      content: '',
    },
  };

  set({
    nodes: updatedNodes,
    selectedNodeId: nodeId,
    cursorPosition: 0,
  });
  triggerAutosave?.();
}

function moveNodeVertically(
  nodeId: string,
  direction: 'up' | 'down',
  state: StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void
): void {
  const { nodes, rootNodeId, ancestorRegistry } = state;
  const node = nodes[nodeId];
  if (!node) return;

  const ancestors = ancestorRegistry[nodeId] || [];
  const parentId = ancestors[ancestors.length - 1] || rootNodeId;
  const parent = nodes[parentId];
  if (!parent) return;

  const currentIndex = parent.children.indexOf(nodeId);
  if (currentIndex < 0) return;

  const canSwapWithinParent = direction === 'up'
    ? currentIndex > 0
    : currentIndex < parent.children.length - 1;

  if (canSwapWithinParent) {
    const updatedNodes = swapSiblings(nodeId, parentId, currentIndex, direction, nodes);
    set({ nodes: updatedNodes });
    triggerAutosave?.();
  } else {
    moveNodeToSiblingParent(nodeId, parentId, direction, ancestors, state, set, triggerAutosave);
  }
}

export const createTreeStructureActions = (
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void
): TreeStructureActions => ({
  indentNode: (nodeId: string) => {
    const state = get();
    const { nodes, ancestorRegistry } = state;
    const node = nodes[nodeId];
    if (!node) return;

    const ancestors = ancestorRegistry[nodeId] || [];
    const currentParentId = ancestors[ancestors.length - 1] || state.rootNodeId;
    const currentParent = nodes[currentParentId];
    if (!currentParent) return;

    const currentIndex = currentParent.children.indexOf(nodeId);
    if (currentIndex === 0) return;

    const newParentId = currentParent.children[currentIndex - 1];
    const newParent = nodes[newParentId];
    if (!newParent) return;

    const { updatedNodes, newAncestorRegistry } = reparentNode(
      nodeId,
      currentParentId,
      newParentId,
      'end',
      state
    );

    set({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
    });
    triggerAutosave?.();
  },

  outdentNode: (nodeId: string) => {
    const state = get();
    const { nodes, rootNodeId, ancestorRegistry } = state;
    const node = nodes[nodeId];
    if (!node) return;

    const ancestors = ancestorRegistry[nodeId] || [];
    if (ancestors.length === 0) return;

    const currentParentId = ancestors[ancestors.length - 1];
    if (currentParentId === rootNodeId) return;

    const currentParent = nodes[currentParentId];
    if (!currentParent) return;

    const grandparentId = ancestors[ancestors.length - 2] || rootNodeId;
    const grandparent = nodes[grandparentId];
    if (!grandparent) return;

    const parentIndexInGrandparent = grandparent.children.indexOf(currentParentId);
    const { updatedNodes, newAncestorRegistry } = reparentNode(
      nodeId,
      currentParentId,
      grandparentId,
      parentIndexInGrandparent + 1,
      state
    );

    set({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
    });
    triggerAutosave?.();
  },

  moveNodeUp: (nodeId: string) => {
    moveNodeVertically(nodeId, 'up', get(), set, triggerAutosave);
  },

  moveNodeDown: (nodeId: string) => {
    moveNodeVertically(nodeId, 'down', get(), set, triggerAutosave);
  },

  deleteNode: (nodeId: string, confirmed = false) => {
    const state = get();
    const { nodes, rootNodeId, ancestorRegistry } = state;
    const node = nodes[nodeId];
    if (!node) return true;

    if (node.children.length > 0 && !confirmed) {
      return false;
    }

    const ancestors = ancestorRegistry[nodeId] || [];
    const parentId = ancestors[ancestors.length - 1] || rootNodeId;
    const parent = nodes[parentId];
    if (!parent) return true;

    if (isLastRootLevelNode(nodeId, parentId, rootNodeId, parent)) {
      clearNodeContent(nodeId, node, nodes, set, triggerAutosave);
      return true;
    }

    const updatedParentChildren = parent.children.filter((id) => id !== nodeId);

    let updatedNodes = recursivelyDeleteNode(nodeId, nodes);

    updatedNodes = {
      ...updatedNodes,
      [parentId]: {
        ...parent,
        children: updatedParentChildren,
      },
    };

    const newAncestorRegistry = buildAncestorRegistry(rootNodeId, updatedNodes);

    set({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
    });
    triggerAutosave?.();

    return true;
  },
});
