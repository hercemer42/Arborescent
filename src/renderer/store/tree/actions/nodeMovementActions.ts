import { TreeNode } from '../../../../shared/types';
import { AncestorRegistry, buildAncestorRegistry } from '../../../utils/ancestry';
import { VisualEffectsActions } from './visualEffectsActions';
import { NavigationActions } from './navigationActions';

export interface NodeMovementActions {
  indentNode: (nodeId: string) => void;
  outdentNode: (nodeId: string) => void;
  moveNodeUp: (nodeId: string) => void;
  moveNodeDown: (nodeId: string) => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
};
type StoreSetter = (partial: Partial<StoreState>) => void;

function reparentNode(
  nodeId: string,
  oldParentId: string,
  newParentId: string,
  insertAt: 'start' | 'end' | number,
  state: { nodes: Record<string, TreeNode>; rootNodeId: string }
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

export const createNodeMovementActions = (
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void,
  visualEffects?: VisualEffectsActions,
  navigation?: NavigationActions
): NodeMovementActions => {
  function indentNode(nodeId: string): void {
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

    // Move selection up before reparenting if parent is collapsed
    const isCollapsed = !newParent.metadata.expanded && newParent.children.length > 0;
    if (isCollapsed && navigation) {
      const fullState = get() as StoreState & { cursorPosition: number; rememberedVisualX: number | null };
      navigation.moveUp(fullState.cursorPosition, fullState.rememberedVisualX);
    }

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

    if (isCollapsed && visualEffects) {
      visualEffects.flashNode(newParentId);
    }

    triggerAutosave?.();
  }

  function outdentNode(nodeId: string): void {
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
  }

  function moveNodeUp(nodeId: string): void {
    moveNodeVertically(nodeId, 'up', get(), set, triggerAutosave);
  }

  function moveNodeDown(nodeId: string): void {
    moveNodeVertically(nodeId, 'down', get(), set, triggerAutosave);
  }

  return {
    indentNode,
    outdentNode,
    moveNodeUp,
    moveNodeDown,
  };
};
