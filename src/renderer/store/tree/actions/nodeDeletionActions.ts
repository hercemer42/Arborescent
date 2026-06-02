import { TreeNode } from '../../../../shared/types';
import {
  isLastRootLevelNode,
  getParentId,
  findPreviousNode,
  getNodeAndDescendantIds,
} from '../../../utils/nodeHelpers';
import { DeleteNodeCommand } from '../commands/DeleteNodeCommand';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import { captureStepDeletions, notifyDeletionDisruption } from './workflowDisruption';
import { collectBoundSessionIds, releaseSessionBindings } from './sessionBindingCleanup';

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
  workflowSessionMap?: Record<string, string>;
};
type StoreSetter = (partial: Partial<StoreState>) => void;

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

    if (collaboratingNodeId === nodeId) {
      useToastStore.getState().addToast(
        'Cannot delete node in collaboration - Please finish or cancel the collaboration first',
        'error'
      );
      logger.error('Cannot delete node in collaboration', new Error('Node is being collaborated on'), 'TreeStore');
      return false;
    }

    if (node.children.length > 0 && !confirmed) return false;

    const parentId = getParentId(nodeId, state.ancestorRegistry, state.rootNodeId);
    const parent = nodes[parentId];
    if (!parent) return true;

    if (isLastRootLevelNode(parentId, rootNodeId, parent)) {
      clearNodeContent(nodeId, state, set, triggerAutosave);
      return true;
    }

    if (!state.actions?.executeCommand) {
      throw new Error('Command system not initialized - cannot delete node with undo/redo support');
    }

    const descendantIds = getNodeAndDescendantIds([nodeId], nodes);
    const releasedSessionIds = collectBoundSessionIds(descendantIds, nodes);
    const stepDeletions = captureStepDeletions([nodeId], state);

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

    notifyDeletionDisruption(get, descendantIds, stepDeletions);

    releaseSessionBindings(releasedSessionIds, get, set);

    return true;
  }

  return {
    deleteNode,
  };
};
