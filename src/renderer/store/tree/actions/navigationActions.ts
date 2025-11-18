import { TreeNode } from '../../../../shared/types';
import { findPreviousNode, findNextNode } from '../../../utils/nodeHelpers';
import { ToggleExpandCommand } from '../commands/ToggleExpandCommand';

export interface NavigationActions {
  moveUp: (cursorPosition?: number, rememberedVisualX?: number | null) => void;
  moveDown: (cursorPosition?: number, rememberedVisualX?: number | null) => void;
  moveBack: () => void;
  moveForward: () => void;
  toggleNode: (nodeId: string) => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  activeNodeId: string | null;
  cursorPosition: number;
  rememberedVisualX: number | null;
};
type StoreSetter = (partial: Partial<StoreState>) => void;

function selectNode(
  nextNodeId: string,
  cursorPosition?: number,
  rememberedVisualX?: number | null
): Partial<StoreState> {
  const update: Partial<StoreState> = { activeNodeId: nextNodeId };

  if (cursorPosition !== undefined) {
    update.cursorPosition = cursorPosition;
  }
  if (rememberedVisualX !== undefined) {
    update.rememberedVisualX = rememberedVisualX;
  }

  return update;
}

export const createNavigationActions = (
  get: () => StoreState,
  set: StoreSetter
): NavigationActions => {
  function moveUp(cursorPosition?: number, rememberedVisualX?: number | null): void {
    const { activeNodeId, nodes, rootNodeId, ancestorRegistry } = get();
    if (!activeNodeId) return;

    const nextNodeId = findPreviousNode(activeNodeId, nodes, rootNodeId, ancestorRegistry);
    if (nextNodeId) {
      const nextNode = nodes[nextNodeId];
      const position = cursorPosition !== undefined ? cursorPosition : nextNode?.content.length ?? 0;
      set(selectNode(nextNodeId, position, rememberedVisualX));
    }
  }

  function moveDown(cursorPosition?: number, rememberedVisualX?: number | null): void {
    const { activeNodeId, nodes, rootNodeId, ancestorRegistry } = get();
    if (!activeNodeId) {
      const root = nodes[rootNodeId];
      if (root?.children.length > 0) {
        set({
          activeNodeId: root.children[0],
          cursorPosition: 0,
          rememberedVisualX: null,
        });
      }
      return;
    }

    const nextNodeId = findNextNode(activeNodeId, nodes, rootNodeId, ancestorRegistry);
    if (nextNodeId) {
      const position = cursorPosition !== undefined ? cursorPosition : 0;
      set(selectNode(nextNodeId, position, rememberedVisualX));
    }
  }

  function moveBack(): void {
    const { activeNodeId, nodes, rootNodeId, ancestorRegistry } = get();
    if (!activeNodeId) return;

    const nextNodeId = findPreviousNode(activeNodeId, nodes, rootNodeId, ancestorRegistry);
    if (nextNodeId) {
      const nextNode = nodes[nextNodeId];
      set({
        activeNodeId: nextNodeId,
        cursorPosition: nextNode?.content.length ?? 0,
        rememberedVisualX: null,
      });
    }
  }

  function moveForward(): void {
    const { activeNodeId, nodes, rootNodeId, ancestorRegistry } = get();
    if (!activeNodeId) return;

    const nextNodeId = findNextNode(activeNodeId, nodes, rootNodeId, ancestorRegistry);
    if (nextNodeId) {
      set({
        activeNodeId: nextNodeId,
        cursorPosition: 0,
        rememberedVisualX: null,
      });
    }
  }

  function toggleNode(nodeId: string): void {
    const state = get() as StoreState & { actions?: { executeCommand?: (cmd: unknown) => void } };
    const { nodes } = state;
    const node = nodes[nodeId];
    if (!node) return;

    // Only allow toggling if the node has children
    if (node.children.length === 0) return;

    if (!state.actions?.executeCommand) {
      throw new Error('Command system not initialized - cannot toggle expand with undo/redo support');
    }

    const command = new ToggleExpandCommand(
      nodeId,
      () => (get() as StoreState).nodes,
      (updatedNodes) => set({ nodes: updatedNodes }),
      (nodeId, cursorPosition) => set({ activeNodeId: nodeId, cursorPosition }),
      undefined // no autosave for expand/collapse
    );
    state.actions.executeCommand(command);
  }

  return {
    moveUp,
    moveDown,
    moveBack,
    moveForward,
    toggleNode,
  };
};
