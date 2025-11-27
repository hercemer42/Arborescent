import { TreeNode } from '../../../../shared/types';
import { AncestorRegistry } from '../../../services/ancestry';
import { VisualEffectsActions } from './visualEffectsActions';
import { NavigationActions } from './navigationActions';
import { MoveNodeCommand } from '../commands/MoveNodeCommand';

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

function calculateSwapPosition(
  currentIndex: number,
  direction: 'up' | 'down'
): number {
  return direction === 'up' ? currentIndex - 1 : currentIndex + 1;
}

function calculateSiblingParentMove(
  parentId: string,
  direction: 'up' | 'down',
  ancestors: string[],
  state: StoreState
): { newParentId: string; newPosition: number } | null {
  const { nodes, rootNodeId } = state;
  const grandparentId = ancestors[ancestors.length - 2] || rootNodeId;
  const grandparent = nodes[grandparentId];
  if (!grandparent) return null;

  const parentIndexInGrandparent = grandparent.children.indexOf(parentId);

  const canMoveToSiblingParent = direction === 'up'
    ? parentIndexInGrandparent > 0
    : parentIndexInGrandparent >= 0 && parentIndexInGrandparent < grandparent.children.length - 1;

  if (!canMoveToSiblingParent) return null;

  const newParentIndex = direction === 'up'
    ? parentIndexInGrandparent - 1
    : parentIndexInGrandparent + 1;
  const newParentId = grandparent.children[newParentIndex];
  const newParent = nodes[newParentId];
  if (!newParent) return null;

  const newPosition = direction === 'up' ? newParent.children.length : 0;
  return { newParentId, newPosition };
}

function moveNodeVertically(
  nodeId: string,
  direction: 'up' | 'down',
  state: StoreState & { actions?: { executeCommand?: (cmd: unknown) => void } },
  set: StoreSetter,
  get: () => StoreState,
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

  // Determine target position
  const canSwapWithinParent = direction === 'up'
    ? currentIndex > 0
    : currentIndex < parent.children.length - 1;

  let newParentId: string;
  let newPosition: number;

  if (canSwapWithinParent) {
    newParentId = parentId;
    newPosition = calculateSwapPosition(currentIndex, direction);
  } else {
    const moveInfo = calculateSiblingParentMove(parentId, direction, ancestors, state);
    if (!moveInfo) return;
    newParentId = moveInfo.newParentId;
    newPosition = moveInfo.newPosition;
  }

  // Execute the move
  if (!state.actions?.executeCommand) {
    throw new Error('Command system not initialized - cannot move node with undo/redo support');
  }

  const command = new MoveNodeCommand(
    nodeId,
    newParentId,
    newPosition,
    () => {
      const currentState = get();
      return {
        nodes: currentState.nodes,
        rootNodeId: currentState.rootNodeId,
        ancestorRegistry: currentState.ancestorRegistry,
      };
    },
    (partial) => set(partial as Partial<StoreState>),
    triggerAutosave
  );
  state.actions.executeCommand(command);
}

export const createNodeMovementActions = (
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void,
  visualEffects?: VisualEffectsActions,
  navigation?: NavigationActions
): NodeMovementActions => {
  /**
   * Helper to execute a move command with less boilerplate
   */
  function executeMoveCommand(nodeId: string, newParentId: string, newPosition: number): void {
    const state = get() as StoreState & { actions?: { executeCommand?: (cmd: unknown) => void } };

    if (!state.actions?.executeCommand) {
      throw new Error('Command system not initialized - cannot move node with undo/redo support');
    }

    const command = new MoveNodeCommand(
      nodeId,
      newParentId,
      newPosition,
      () => {
        const currentState = get() as StoreState;
        return {
          nodes: currentState.nodes,
          rootNodeId: currentState.rootNodeId,
          ancestorRegistry: currentState.ancestorRegistry,
        };
      },
      (partial) => set(partial as Partial<StoreState>),
      triggerAutosave
    );
    state.actions.executeCommand(command);
  }

  function indentNode(nodeId: string): void {
    const state = get() as StoreState;
    const { nodes, ancestorRegistry, rootNodeId } = state;
    const node = nodes[nodeId];
    if (!node) return;

    const ancestors = ancestorRegistry[nodeId] || [];
    const currentParentId = ancestors[ancestors.length - 1] || rootNodeId;
    const currentParent = nodes[currentParentId];
    if (!currentParent) return;

    const currentIndex = currentParent.children.indexOf(nodeId);
    if (currentIndex === 0) return;

    const newParentId = currentParent.children[currentIndex - 1];
    const newParent = nodes[newParentId];
    if (!newParent) return;

    // Move selection up before reparenting if parent is collapsed
    const isCollapsed = !(newParent.metadata.expanded ?? true) && newParent.children.length > 0;
    if (isCollapsed && navigation) {
      const fullState = get() as StoreState & { cursorPosition: number; rememberedVisualX: number | null };
      navigation.moveUp(fullState.cursorPosition, fullState.rememberedVisualX);
    }

    // Execute the move
    executeMoveCommand(nodeId, newParentId, newParent.children.length);

    // Flash effect after moving into collapsed parent
    if (visualEffects && isCollapsed) {
      visualEffects.flashNode(newParentId, 'medium');
    }
  }

  function outdentNode(nodeId: string): void {
    const state = get() as StoreState;
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

    // Execute the move
    executeMoveCommand(nodeId, grandparentId, parentIndexInGrandparent + 1);

    // Scroll to maintain visual position
    if (visualEffects) {
      visualEffects.scrollToNode(nodeId);
    }
  }

  function moveNodeUp(nodeId: string): void {
    const state = get() as StoreState & { actions?: { executeCommand?: (cmd: unknown) => void } };
    moveNodeVertically(nodeId, 'up', state, set, get, triggerAutosave);
  }

  function moveNodeDown(nodeId: string): void {
    const state = get() as StoreState & { actions?: { executeCommand?: (cmd: unknown) => void } };
    moveNodeVertically(nodeId, 'down', state, set, get, triggerAutosave);
  }

  function dropNode(
    nodeId: string,
    targetNodeId: string,
    dropZone: 'before' | 'after' | 'child'
  ): void {
    const state = get() as StoreState;
    const { nodes } = state;

    // Calculate drop target position
    const dropTarget = calculateDropTarget(nodeId, targetNodeId, dropZone, state);
    if (!dropTarget) return;

    const { targetParentId, insertAt } = dropTarget;

    // Convert insertAt to numeric position
    const newPosition = insertAt === 'start' ? 0
      : insertAt === 'end' ? (nodes[targetParentId]?.children.length ?? 0)
      : insertAt;

    // Execute the move
    executeMoveCommand(nodeId, targetParentId, newPosition);

    // Flash effect
    if (visualEffects) {
      if (dropZone === 'child') {
        const target = get().nodes[targetNodeId];
        const isCollapsed = !(target?.metadata.expanded ?? true);
        visualEffects.flashNode(targetNodeId, isCollapsed ? 'medium' : 'light');
      } else {
        visualEffects.flashNode(nodeId);
      }
    }
  }

  return {
    indentNode,
    outdentNode,
    moveNodeUp,
    moveNodeDown,
    dropNode,
  };
};
