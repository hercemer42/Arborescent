import { BaseCommand } from './Command';
import { TreeNode, NodeStatus } from '../../../../shared/types';
import { getAllDescendants } from '../../../utils/nodeHelpers';

interface NodeStatusState {
  status: NodeStatus | undefined;
  resolvedAt: string | undefined;
}

/**
 * Command for setting status on a node and all its descendants.
 * Used for "Mark all as complete" and "Mark all as incomplete" actions.
 */
export class SetStatusBatchCommand extends BaseCommand {
  private previousStates: Map<string, NodeStatusState> = new Map();
  private affectedNodeIds: string[] = [];
  private resolvedAt: string | undefined;

  constructor(
    private nodeId: string,
    private targetStatus: NodeStatus,
    private getNodes: () => Record<string, TreeNode>,
    private setNodes: (nodes: Record<string, TreeNode>) => void,
    private triggerAutosave?: () => void,
    private onStatusChange?: () => void
  ) {
    super();
    this.description = `Set status to ${targetStatus} for ${nodeId} and descendants`;
  }

  execute(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    this.previousStates.clear();
    this.affectedNodeIds = [];

    // Set resolvedAt for completed/abandoned, clear for pending
    const isResolved = this.targetStatus === 'completed' || this.targetStatus === 'abandoned';
    this.resolvedAt = isResolved ? new Date().toISOString() : undefined;

    // Get node + all descendants
    const descendantIds = getAllDescendants(this.nodeId, nodes);
    const allNodeIds = [this.nodeId, ...descendantIds];

    let updatedNodes = nodes;

    for (const id of allNodeIds) {
      const targetNode = updatedNodes[id];
      if (!targetNode) continue;

      // Capture previous state
      this.previousStates.set(id, {
        status: targetNode.metadata.status as NodeStatus | undefined,
        resolvedAt: targetNode.metadata.resolvedAt as string | undefined,
      });
      this.affectedNodeIds.push(id);

      // Update status
      updatedNodes = {
        ...updatedNodes,
        [id]: {
          ...targetNode,
          metadata: {
            ...targetNode.metadata,
            status: this.targetStatus,
            resolvedAt: this.resolvedAt,
          },
        },
      };
    }

    this.setNodes(updatedNodes);
    this.triggerAutosave?.();
    this.onStatusChange?.();
  }

  undo(): void {
    const nodes = this.getNodes();
    let updatedNodes = nodes;

    for (const nodeId of this.affectedNodeIds) {
      const previousState = this.previousStates.get(nodeId);
      const node = updatedNodes[nodeId];
      if (!previousState || !node) continue;

      updatedNodes = {
        ...updatedNodes,
        [nodeId]: {
          ...node,
          metadata: {
            ...node.metadata,
            status: previousState.status,
            resolvedAt: previousState.resolvedAt,
          },
        },
      };
    }

    this.setNodes(updatedNodes);
    this.triggerAutosave?.();
    this.onStatusChange?.();
  }

  redo(): void {
    this.execute();
  }
}
