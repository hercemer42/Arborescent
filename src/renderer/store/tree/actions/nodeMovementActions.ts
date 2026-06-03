import { TreeNode } from '../../../../shared/types';
import { AncestorRegistry } from '../../../utils/ancestry';
import { getParentId } from '../../../utils/nodeHelpers';
import { VisualEffectsActions } from './visualEffectsActions';
import { NavigationActions } from './navigationActions';
import { Command } from '../commands/Command';
import { MoveNodeCommand } from '../commands/MoveNodeCommand';
import { useToastStore } from '../../toast/toastStore';

export interface NodeMovementActions {
  indentNode: (nodeId: string) => void;
  outdentNode: (nodeId: string) => void;
  moveNodeUp: (nodeId: string) => void;
  moveNodeDown: (nodeId: string) => void;
  dropNode: (nodeId: string, targetNodeId: string, dropZone: 'before' | 'after' | 'child') => void;
}

export interface NodeMovementDeps {
  executeCommand: (command: Command) => void;
  handleNodeMovedManually?: (nodeId: string) => void;
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

  const nodeAncestors = ancestorRegistry[nodeId] || [];
  const currentParentId = nodeAncestors[nodeAncestors.length - 1] || rootNodeId;

  if (dropZone === 'child') {
    const target = nodes[targetNodeId];
    if (!target) return null;

    const targetAncestors = ancestorRegistry[targetNodeId] || [];
    if (nodeId === targetNodeId || targetAncestors.includes(nodeId)) {
      return null;
    }

    if (currentParentId === targetNodeId) {
      return null;
    }

    return {
      targetParentId: targetNodeId,
      insertAt: 'start',
    };
  } else {
    const targetAncestors = ancestorRegistry[targetNodeId] || [];
    const targetParentId = targetAncestors[targetAncestors.length - 1] || rootNodeId;
    const targetParent = nodes[targetParentId];

    if (!targetParent) return null;

    const targetIndex = targetParent.children.indexOf(targetNodeId);
    if (targetIndex < 0) return null;

    let insertAt = dropZone === 'before' ? targetIndex : targetIndex + 1;

    if (currentParentId === targetParentId) {
      const nodeIndex = targetParent.children.indexOf(nodeId);
      if (nodeIndex >= 0 && nodeIndex < targetIndex) {
        insertAt -= 1;
      }
    }

    return {
      targetParentId,
      insertAt,
    };
  }
}

function validateNodeMove(
  nodeId: string,
  newParentId: string,
  state: StoreState
): string | null {
  const { nodes, ancestorRegistry } = state;
  const sourceNode = nodes[nodeId];
  if (!sourceNode) return null;

  const effectiveParent = nodes[newParentId];
  const isSourceBlueprint = sourceNode.metadata.isBlueprint === true;
  const isSourceWorkflow = sourceNode.metadata.isWorkflow === true;

  if (isSourceBlueprint && effectiveParent && effectiveParent.metadata.isBlueprint !== true) {
    return 'Cannot place a blueprint node in a non-blueprint node';
  }

  if (!isSourceWorkflow) return null;

  const targetAncestors = ancestorRegistry[newParentId] || [];
  if (
    effectiveParent?.metadata.isContextDeclaration === true
    || targetAncestors.some(id => nodes[id]?.metadata.isContextDeclaration === true)
  ) {
    return 'Cannot place a workflow node in a context';
  }

  const grandparentId = targetAncestors[targetAncestors.length - 1];
  if (
    grandparentId
    && nodes[grandparentId]?.metadata.isWorkflow === true
    && effectiveParent?.metadata.isWorkflow !== true
  ) {
    return 'Cannot place a workflow node in a workflow step';
  }

  return null;
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
  state: StoreState,
  set: StoreSetter,
  get: () => StoreState,
  deps: NodeMovementDeps,
  triggerAutosave?: () => void
): void {
  const { nodes, rootNodeId, ancestorRegistry } = state;
  const node = nodes[nodeId];
  if (!node) return;

  const ancestors = ancestorRegistry[nodeId] || [];
  const parentId = getParentId(nodeId, ancestorRegistry, rootNodeId);
  const parent = nodes[parentId];
  if (!parent) return;

  const currentIndex = parent.children.indexOf(nodeId);
  if (currentIndex < 0) return;

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

  if (newParentId !== parentId) {
    const error = validateNodeMove(nodeId, newParentId, state);
    if (error) {
      useToastStore.getState().addToast(error, 'error');
      return;
    }
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
  deps.executeCommand(command);

  if (newParentId !== parentId) {
    deps.handleNodeMovedManually?.(nodeId);
  }
}

export const createNodeMovementActions = (
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave: (() => void) | undefined,
  visualEffects: VisualEffectsActions | undefined,
  navigation: NavigationActions | undefined,
  deps: NodeMovementDeps
): NodeMovementActions => {
  function executeMoveCommand(nodeId: string, newParentId: string, newPosition: number): void {
    const state = get();

    const error = validateNodeMove(nodeId, newParentId, state);
    if (error) {
      useToastStore.getState().addToast(error, 'error');
      return;
    }

    const currentParentId = getParentId(nodeId, state.ancestorRegistry, state.rootNodeId);

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
    deps.executeCommand(command);

    if (newParentId !== currentParentId) {
      deps.handleNodeMovedManually?.(nodeId);
    }
  }

  function indentNode(nodeId: string): void {
    const { nodes, ancestorRegistry, rootNodeId } = get();
    const node = nodes[nodeId];
    if (!node) return;

    const currentParentId = getParentId(nodeId, ancestorRegistry, rootNodeId);
    const currentParent = nodes[currentParentId];
    if (!currentParent) return;

    const currentIndex = currentParent.children.indexOf(nodeId);
    if (currentIndex === 0) return;

    const newParentId = currentParent.children[currentIndex - 1];
    const newParent = nodes[newParentId];
    if (!newParent) return;

    const isCollapsed = !(newParent.metadata.expanded ?? true) && newParent.children.length > 0;
    if (isCollapsed && navigation) {
      const fullState = get() as StoreState & { cursorPosition: number; rememberedVisualX: number | null };
      navigation.moveUp(fullState.cursorPosition, fullState.rememberedVisualX);
    }

    executeMoveCommand(nodeId, newParentId, newParent.children.length);

    if (visualEffects && isCollapsed) {
      visualEffects.flashNode(newParentId, 'medium');
    }
  }

  function outdentNode(nodeId: string): void {
    const { nodes, rootNodeId, ancestorRegistry } = get();
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

    executeMoveCommand(nodeId, grandparentId, parentIndexInGrandparent + 1);

    if (visualEffects) {
      visualEffects.scrollToNode(nodeId);
    }
  }

  function moveNodeUp(nodeId: string): void {
    moveNodeVertically(nodeId, 'up', get(), set, get, deps, triggerAutosave);
  }

  function moveNodeDown(nodeId: string): void {
    moveNodeVertically(nodeId, 'down', get(), set, get, deps, triggerAutosave);
  }

  function dropNode(
    nodeId: string,
    targetNodeId: string,
    dropZone: 'before' | 'after' | 'child'
  ): void {
    const state = get();
    const { nodes } = state;

    const dropTarget = calculateDropTarget(nodeId, targetNodeId, dropZone, state);
    if (!dropTarget) return;

    const { targetParentId, insertAt } = dropTarget;

    const newPosition = insertAt === 'start' ? 0
      : insertAt === 'end' ? (nodes[targetParentId]?.children.length ?? 0)
      : insertAt;

    executeMoveCommand(nodeId, targetParentId, newPosition);

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
