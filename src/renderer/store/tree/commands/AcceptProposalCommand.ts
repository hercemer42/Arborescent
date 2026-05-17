import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { AncestorRegistry } from '../../../utils/ancestry';
import { applyMutation, applyDirectDelete } from '../../../services/mcpTreeMutatorService';
import { applyStepOutput } from '../../../services/mcpStepOutputApplierService';
import { logger } from '../../../services/logger';
import { TreeStore } from '../treeStore';
import type { Proposal } from '../../proposals/proposalsStore';

interface Snapshot {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
}

export class AcceptProposalCommand extends BaseCommand {
  private before: Snapshot | null = null;
  private after: Snapshot | null = null;

  constructor(
    private store: TreeStore,
    private proposal: Proposal,
    private triggerAutosave?: () => void,
  ) {
    super();
    this.description = `Accept proposal ${proposal.id} on node ${proposal.nodeId}`;
  }

  private snapshot(): Snapshot {
    const state = this.store.getState();
    return {
      nodes: state.nodes,
      ancestorRegistry: state.ancestorRegistry,
    };
  }

  private restore(snap: Snapshot): void {
    this.store.setState({ nodes: snap.nodes, ancestorRegistry: snap.ancestorRegistry });
    this.triggerAutosave?.();
  }

  private runApply() {
    const { request, nodeId } = this.proposal;
    if (request.kind === 'submit-step-output') {
      return applyStepOutput(this.store, nodeId, request.content);
    }
    if (request.kind === 'delete') {
      // Route through the direct path so undo is owned solely by this Command's
      // snapshot — applyMutation would otherwise push an inner DeleteNodeCommand
      // onto HistoryManager and we'd have two entries for one logical op.
      return applyDirectDelete(this.store, nodeId);
    }
    return applyMutation(this.store, nodeId, request);
  }

  execute(): void {
    this.before = this.snapshot();
    const result = this.runApply();
    if (!result.ok) {
      logger.error(
        `Accept proposal ${this.proposal.id} failed: ${result.error}`,
        new Error(result.error),
        'AcceptProposalCommand',
      );
      // Leave `after` null so undo/redo are no-ops against an unchanged state.
      return;
    }
    this.after = this.snapshot();
  }

  undo(): void {
    if (this.before && this.after) this.restore(this.before);
  }

  redo(): void {
    if (this.after) this.restore(this.after);
  }
}
