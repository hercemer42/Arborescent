import { TreeNode } from '../../../../shared/types';
import {
  isLastRootLevelNode,
  getParentId,
  findPreviousNode,
  getNodeAndDescendantIds,
} from '../../../utils/nodeHelpers';
import { Command } from '../commands/Command';
// eslint-disable-next-line import/no-cycle -- inert: the command's filesStore read happens on execute, never during module init. Story 2 (storeManager hub topology) removes this edge.
import { DeleteNodeCommand } from '../commands/DeleteNodeCommand';
import { DeleteMultipleNodesCommand } from '../commands/DeleteMultipleNodesCommand';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import { captureStepDeletions, notifyDeletionDisruption, DisruptionActions } from './workflowDisruption';
import { collectBoundSessionIds, releaseSessionBindings } from './sessionBindingCleanup';
import { StepHistoryMap } from '../stepHistory/stepHistory';

export interface NodeDeletionActions {
  deleteNode: (nodeId: string, confirmed?: boolean) => boolean;
  deleteNodes: (nodeIds: string[]) => void;
}

type StoreState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  activeNodeId: string | null;
  cursorPosition: number;
  collaboratingNodeId: string | null;
  workflowSessionMap?: Record<string, string>;
  multiSelectedNodeIds?: Set<string>;
  stepHistory?: StepHistoryMap;
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
  triggerAutosave: (() => void) | undefined,
  executeCommand: (command: Command) => void,
  disruption?: DisruptionActions
): NodeDeletionActions => {

  function commandStateGetter() {
    const currentState = get();
    return {
      nodes: currentState.nodes,
      rootNodeId: currentState.rootNodeId,
      ancestorRegistry: currentState.ancestorRegistry,
      stepHistory: currentState.stepHistory,
    };
  }

  function deleteNodes(nodeIds: string[]): void {
    if (nodeIds.length === 0) return;

    const state = get();

    const allDeletedIds = getNodeAndDescendantIds(nodeIds, state.nodes);
    const releasedSessionIds = collectBoundSessionIds(allDeletedIds, state.nodes);
    const stepDeletions = captureStepDeletions(nodeIds, state);

    const setter = (partial: Partial<StoreState>) => set(partial);
    const command =
      nodeIds.length === 1
        ? new DeleteNodeCommand(nodeIds[0], commandStateGetter, setter, findPreviousNode, triggerAutosave)
        : new DeleteMultipleNodesCommand(nodeIds, commandStateGetter, setter, findPreviousNode, triggerAutosave);
    executeCommand(command);

    notifyDeletionDisruption(get, allDeletedIds, stepDeletions, disruption);

    releaseSessionBindings(releasedSessionIds, get, set);
  }

  function deleteNode(nodeId: string, confirmed = false): boolean {
    const state = get();
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

    deleteNodes([nodeId]);

    return true;
  }

  return {
    deleteNode,
    deleteNodes,
  };
};
