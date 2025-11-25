import { TreeNode } from '../../../../shared/types';
import {
  isLastRootLevelNode,
  getParentNode,
  findPreviousNode,
} from '../../../utils/nodeHelpers';
import { DeleteNodeCommand } from '../commands/DeleteNodeCommand';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';

export interface NodeDeletionActions {
  deleteNode: (nodeId: string, confirmed?: boolean) => boolean;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  activeNodeId: string | null;
  cursorPosition: number;
  collaboratingNodeId: string | null;
};
type StoreSetter = (partial: Partial<StoreState>) => void;

/**
 * Clears a node's content (used when deleting the last root-level node)
 */
function clearNodeContent(
  nodeId: string,
  state: StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void
): void {
  const { nodes } = state;
  const node = nodes[nodeId];
  if (!node) return;

  const updatedNodes = {
    ...nodes,
    [nodeId]: {
      ...node,
      content: '',
    },
  };

  set({
    nodes: updatedNodes,
    activeNodeId: nodeId,
    cursorPosition: 0,
  });
  triggerAutosave?.();
}

export const createNodeDeletionActions = (
  get: () => StoreState,
  set: StoreSetter,
  triggerAutosave?: () => void
): NodeDeletionActions => {

  function deleteNode(nodeId: string, confirmed = false): boolean {
    const state = get() as StoreState & { actions?: { executeCommand?: (cmd: unknown) => void } };
    const { nodes, rootNodeId, collaboratingNodeId } = state;
    const node = nodes[nodeId];
    if (!node) return true;

    // Prevent deletion of node in collaboration
    if (collaboratingNodeId === nodeId) {
      useToastStore.getState().addToast(
        'Cannot delete node in collaboration - Please finish or cancel the collaboration first',
        'error'
      );
      logger.error('Cannot delete node in collaboration', new Error('Node is being collaborated on'), 'TreeStore');
      return false;
    }

    // Require confirmation if node has children
    if (node.children.length > 0 && !confirmed) return false;

    const parentInfo = getParentNode(nodeId, state);
    if (!parentInfo) return true;

    const { parentId, parent } = parentInfo;

    // If this is the last root-level node, just clear its content (not undoable)
    if (isLastRootLevelNode(parentId, rootNodeId, parent)) {
      clearNodeContent(nodeId, state, set, triggerAutosave);
      return true;
    }

    if (!state.actions?.executeCommand) {
      throw new Error('Command system not initialized - cannot delete node with undo/redo support');
    }

    const command = new DeleteNodeCommand(
      nodeId,
      () => {
        const currentState = get() as StoreState;
        return {
          nodes: currentState.nodes,
          rootNodeId: currentState.rootNodeId,
          ancestorRegistry: currentState.ancestorRegistry,
        };
      },
      (partial) => set(partial as Partial<StoreState>),
      findPreviousNode,
      triggerAutosave
    );
    state.actions.executeCommand(command);

    return true;
  }

  return {
    deleteNode,
  };
};
