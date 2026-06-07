import { TreeNode } from '../../../../shared/types';
import {
  isLastRootLevelNode,
  getParentId,
  findPreviousNode,
  getNodeAndDescendantIds,
} from '../../../utils/nodeHelpers';
import { Command } from '../commands/Command';
import { DeleteNodeCommand } from '../commands/DeleteNodeCommand';
import { DeleteMultipleNodesCommand } from '../commands/DeleteMultipleNodesCommand';
import { logger } from '../../../services/logger';
import { useToastStore } from '../../toast/toastStore';
import { captureStepDeletions, notifyDeletionDisruption, DisruptionActions } from './workflowDisruption';
import { collectBoundSessionIds, releaseSessionBindings } from './sessionBindingCleanup';
import { StepHistoryMap } from '../stepHistory/stepHistory';
import { isNodeInReview, removeReview, type ReviewMap } from '../reviews';
import { dropPendingProposal, type PendingProposalMap } from '../pendingProposals/pendingProposals';
import { feedbackTreeStore } from '../../feedback/feedbackTreeStore';

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
  reviews: ReviewMap;
  pendingProposals?: PendingProposalMap;
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

    // Any review whose node was just removed (as part of an ancestor's subtree) is discarded so no
    // ghost review, persisted proposition, or working store outlives the node it targeted.
    const reviewedDeleted = allDeletedIds.filter((id) => isNodeInReview(get().reviews, id));
    if (reviewedDeleted.length > 0) {
      let reviews = get().reviews;
      let pending = get().pendingProposals ?? {};
      for (const id of reviewedDeleted) {
        reviews = removeReview(reviews, id);
        pending = dropPendingProposal(pending, id);
        feedbackTreeStore.clearForNode(id);
      }
      set({ reviews, pendingProposals: pending });
    }
  }

  function deleteNode(nodeId: string, confirmed = false): boolean {
    const state = get();
    const { nodes, rootNodeId } = state;
    const node = nodes[nodeId];
    if (!node) return true;

    if (isNodeInReview(state.reviews, nodeId)) {
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
