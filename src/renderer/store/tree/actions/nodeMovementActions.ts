import { TreeNode } from '../../../../shared/types';
import { AncestorRegistry, buildAncestorRegistry } from '../../../utils/ancestry';
import { VisualEffectsActions } from './visualEffectsActions';
import { NavigationActions } from './navigationActions';

export interface NodeMovementActions {
  indentNode: (nodeId: string) => void;
  outdentNode: (nodeId: string) => void;
  moveNodeUp: (nodeId: string) => void;
  moveNodeDown: (nodeId: string) => void;
  dropNode: (nodeId: string, targetNodeId: string, dropZone: 'before' | 'after' | 'child') => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
};
type StoreSetter = (partial: Partial<StoreState>) => void;

function moveWithinParent(
  nodeId: string,
  parentId: string,
  insertAt: 'start' | 'end' | number,
  nodes: Record<string, TreeNode>
): Record<string, TreeNode> {
  const parent = nodes[parentId];
  const currentIndex = parent.children.indexOf(nodeId);

  // Remove from current position
  const childrenWithoutNode = parent.children.filter((id) => id !== nodeId);

  // Calculate new index (accounting for removal)
  let newIndex: number;
  if (insertAt === 'start') {
    newIndex = 0;
  } else if (insertAt === 'end') {
    newIndex = childrenWithoutNode.length;
  } else {
    newIndex = insertAt;
    // If inserting after the current position, adjust index down by 1
    // since we already removed the node
    if (insertAt > currentIndex) {
      newIndex = insertAt - 1;
    }
  }

  // Insert at new position
  const updatedChildren = [...childrenWithoutNode];
  updatedChildren.splice(newIndex, 0, nodeId);

  return {
    ...nodes,
    [parentId]: {
      ...parent,
      children: updatedChildren,
    },
  };
}

function moveBetweenParents(
  nodeId: string,
  oldParentId: string,
  newParentId: string,
  insertAt: 'start' | 'end' | number,
  nodes: Record<string, TreeNode>
): Record<string, TreeNode> {
  const oldParent = nodes[oldParentId];
  const newParent = nodes[newParentId];

  // Remove from old parent
  const updatedOldParentChildren = oldParent.children.filter((id) => id !== nodeId);

  // Add to new parent at specified position
  let updatedNewParentChildren: string[];
  if (insertAt === 'end') {
    updatedNewParentChildren = [...newParent.children, nodeId];
  } else if (insertAt === 'start') {
    updatedNewParentChildren = [nodeId, ...newParent.children];
  } else {
    updatedNewParentChildren = [...newParent.children];
    updatedNewParentChildren.splice(insertAt, 0, nodeId);
  }

  return {
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
}

function moveNode(
  nodeId: string,
  oldParentId: string,
  newParentId: string,
  insertAt: 'start' | 'end' | number,
  state: { nodes: Record<string, TreeNode>; rootNodeId: string }
): { updatedNodes: Record<string, TreeNode>; newAncestorRegistry: AncestorRegistry } {
  const { nodes, rootNodeId } = state;

  const updatedNodes = oldParentId === newParentId
    ? moveWithinParent(nodeId, oldParentId, insertAt, nodes)
    : moveBetweenParents(nodeId, oldParentId, newParentId, insertAt, nodes);

  const newAncestorRegistry = buildAncestorRegistry(rootNodeId, updatedNodes);

  return { updatedNodes, newAncestorRegistry };
}

function calculateDropTarget(
  nodeId: string,
  targetNodeId: string,
  dropZone: 'before' | 'after' | 'child',
  state: StoreState
): { targetParentId: string; insertAt: 'start' | 'end' | number } | null {
  const { nodes, rootNodeId, ancestorRegistry } = state;

  // Get node's current parent
  const nodeAncestors = ancestorRegistry[nodeId] || [];
  const currentParentId = nodeAncestors[nodeAncestors.length - 1] || rootNodeId;

  if (dropZone === 'child') {
    // Drop as child of target
    const target = nodes[targetNodeId];
    if (!target) return null;

    // Don't allow dropping a node onto itself or its descendants
    const targetAncestors = ancestorRegistry[targetNodeId] || [];
    if (nodeId === targetNodeId || targetAncestors.includes(nodeId)) {
      return null;
    }

    // If already a child of this parent, do nothing
    if (currentParentId === targetNodeId) {
      return null;
    }

    return {
      targetParentId: targetNodeId,
      insertAt: 'end',
    };
  } else {
    // Drop as sibling (before or after)
    const targetAncestors = ancestorRegistry[targetNodeId] || [];
    const targetParentId = targetAncestors[targetAncestors.length - 1] || rootNodeId;
    const targetParent = nodes[targetParentId];

    if (!targetParent) return null;

    const targetIndex = targetParent.children.indexOf(targetNodeId);
    if (targetIndex < 0) return null;

    return {
      targetParentId,
      insertAt: dropZone === 'before' ? targetIndex : targetIndex + 1,
    };
  }
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
  const { updatedNodes, newAncestorRegistry } = moveNode(
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

    const { updatedNodes, newAncestorRegistry } = moveNode(
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

    if (visualEffects) {
      if (isCollapsed) {
        // Flash the parent when indenting into a collapsed parent (medium intensity)
        visualEffects.flashNode(newParentId, 'medium');
      } else {
        // Flash the node itself when indenting into an expanded parent (light intensity - default)
        visualEffects.flashNode(nodeId);
      }
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
    const { updatedNodes, newAncestorRegistry } = moveNode(
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

    if (visualEffects) {
      // Flash the outdented node (light intensity - default)
      visualEffects.flashNode(nodeId);
      // Scroll to the outdented node to maintain visual position
      visualEffects.scrollToNode(nodeId);
    }

    triggerAutosave?.();
  }

  function moveNodeUp(nodeId: string): void {
    moveNodeVertically(nodeId, 'up', get(), set, triggerAutosave);
  }

  function moveNodeDown(nodeId: string): void {
    moveNodeVertically(nodeId, 'down', get(), set, triggerAutosave);
  }

  function dropNode(
    nodeId: string,
    targetNodeId: string,
    dropZone: 'before' | 'after' | 'child'
  ): void {
    const state = get();
    const { nodes, ancestorRegistry } = state;

    // Calculate drop target position
    const dropTarget = calculateDropTarget(nodeId, targetNodeId, dropZone, state);
    if (!dropTarget) return;

    const { targetParentId, insertAt } = dropTarget;

    // Get node's current parent
    const nodeAncestors = ancestorRegistry[nodeId] || [];
    const currentParentId = nodeAncestors[nodeAncestors.length - 1] || state.rootNodeId;

    // Execute move
    const { updatedNodes, newAncestorRegistry } = moveNode(
      nodeId,
      currentParentId,
      targetParentId,
      insertAt,
      state
    );

    set({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
    });

    // Flash effect
    if (visualEffects) {
      if (dropZone === 'child') {
        const target = updatedNodes[targetNodeId];
        const isCollapsed = !(target.metadata.expanded ?? true);
        visualEffects.flashNode(targetNodeId, isCollapsed ? 'medium' : 'light');
      } else {
        visualEffects.flashNode(nodeId);
      }
    }

    triggerAutosave?.();
  }

  return {
    indentNode,
    outdentNode,
    moveNodeUp,
    moveNodeDown,
    dropNode,
  };
};
