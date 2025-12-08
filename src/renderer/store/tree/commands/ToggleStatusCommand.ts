import { BaseCommand } from './Command';
import { TreeNode, NodeStatus } from '../../../../shared/types';

/**
 * Command for toggling node task status
 */
export class ToggleStatusCommand extends BaseCommand {
  private oldStatus: NodeStatus | undefined;
  private newStatus: NodeStatus | undefined;
  private oldResolvedAt: string | undefined;
  private newResolvedAt: string | undefined;

  constructor(
    private nodeId: string,
    private getNodes: () => Record<string, TreeNode>,
    private setNodes: (nodes: Record<string, TreeNode>) => void,
    private selectNode: (nodeId: string, cursorPosition: number) => void,
    private triggerAutosave?: () => void,
    private onStatusChange?: () => void
  ) {
    super();
    this.description = `Toggle status ${nodeId}`;
  }

  execute(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    // Capture old state
    this.oldStatus = node.metadata?.status as NodeStatus | undefined;
    this.oldResolvedAt = node.metadata?.resolvedAt as string | undefined;

    // Calculate new status
    const currentStatus = node.metadata?.status;
    let newStatus: NodeStatus | undefined;

    if (!currentStatus || currentStatus === 'pending') {
      newStatus = 'completed';
    } else if (currentStatus === 'completed') {
      newStatus = 'abandoned';
    } else {
      newStatus = 'pending';
    }

    this.newStatus = newStatus;

    // Set resolvedAt when transitioning to completed/abandoned, clear when going to pending
    const isResolved = newStatus === 'completed' || newStatus === 'abandoned';
    this.newResolvedAt = isResolved ? new Date().toISOString() : undefined;

    // Update node
    this.setNodes({
      ...nodes,
      [this.nodeId]: {
        ...node,
        metadata: {
          ...node.metadata,
          status: newStatus,
          resolvedAt: this.newResolvedAt,
        },
      },
    });

    this.triggerAutosave?.();
    this.onStatusChange?.();
  }

  undo(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    // Restore old status and resolvedAt
    this.setNodes({
      ...nodes,
      [this.nodeId]: {
        ...node,
        metadata: {
          ...node.metadata,
          status: this.oldStatus,
          resolvedAt: this.oldResolvedAt,
        },
      },
    });

    // Select node and place cursor at end
    this.selectNode(this.nodeId, node.content.length);
    this.triggerAutosave?.();
    this.onStatusChange?.();
  }

  redo(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    // Apply new status and resolvedAt
    this.setNodes({
      ...nodes,
      [this.nodeId]: {
        ...node,
        metadata: {
          ...node.metadata,
          status: this.newStatus,
          resolvedAt: this.newResolvedAt,
        },
      },
    });

    // Select node and place cursor at end
    this.selectNode(this.nodeId, node.content.length);
    this.triggerAutosave?.();
    this.onStatusChange?.();
  }
}
