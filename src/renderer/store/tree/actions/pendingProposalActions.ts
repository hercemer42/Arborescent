import type { TreeNode } from '../../../../shared/types';
import { logger } from '../../../services/logger';
import { reconcileFeedback } from '../../feedback/reconcileFeedback';
import { AcceptFeedbackCommand } from '../commands/AcceptFeedbackCommand';
import type { Command } from '../commands/Command';
import {
  capturePendingProposal,
  dropPendingProposal as dropFromMap,
  setPendingProposal,
} from '../pendingProposals/pendingProposals';
import type { TreeState } from '../treeStore';

export interface PendingProposalActions {
  openPendingProposal: (
    reviewedNodeId: string,
    propositionRootId: string,
    propositionNodes: Record<string, TreeNode>,
  ) => void;
  dropPendingProposal: (reviewedNodeId: string) => void;
  promotePendingProposal: (reviewedNodeId: string) => void;
}

export function createPendingProposalActions(
  get: () => TreeState,
  set: (partial: Partial<TreeState>) => void,
  autoSave: () => void,
  executeCommand: (command: Command) => void,
): PendingProposalActions {
  function openPendingProposal(
    reviewedNodeId: string,
    propositionRootId: string,
    propositionNodes: Record<string, TreeNode>,
  ): void {
    const entry = capturePendingProposal(reviewedNodeId, propositionRootId, propositionNodes);
    set({ pendingProposals: setPendingProposal(get().pendingProposals ?? {}, entry) });
  }

  function dropPendingProposal(reviewedNodeId: string): void {
    set({ pendingProposals: dropFromMap(get().pendingProposals ?? {}, reviewedNodeId) });
  }

  function promotePendingProposal(reviewedNodeId: string): void {
    const state = get();
    const entry = state.pendingProposals?.[reviewedNodeId];
    if (!entry) {
      logger.warn(`No pending proposition to promote for node ${reviewedNodeId}`, 'PendingProposal');
      return;
    }
    if (!state.nodes[reviewedNodeId]) {
      logger.error(
        `Cannot promote proposition: reviewed node ${reviewedNodeId} no longer exists`,
        undefined,
        'PendingProposal',
      );
      return;
    }

    if (!entry.nodes[entry.rootNodeId]) {
      logger.warn(
        `Pending proposition for node ${reviewedNodeId} has no root snapshot; nothing to promote`,
        'PendingProposal',
      );
      return;
    }

    const { idMap } = reconcileFeedback({
      priorRootId: reviewedNodeId,
      priorNodes: state.nodes,
      newRootId: entry.rootNodeId,
      newNodes: entry.nodes,
      mode: 'feedback',
    });

    executeCommand(
      new AcceptFeedbackCommand(reviewedNodeId, entry.rootNodeId, entry.nodes, get, set, autoSave, undefined, idMap),
    );

    set({ pendingProposals: dropFromMap(get().pendingProposals ?? {}, reviewedNodeId) });
  }

  return { openPendingProposal, dropPendingProposal, promotePendingProposal };
}
