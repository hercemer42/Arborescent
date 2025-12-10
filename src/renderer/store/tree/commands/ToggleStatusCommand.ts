import { BaseCommand } from './Command';
import { TreeNode, NodeStatus } from '../../../../shared/types';

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

    this.oldStatus = node.metadata?.status as NodeStatus | undefined;
    this.oldResolvedAt = node.metadata?.resolvedAt as string | undefined;

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

    const isResolved = newStatus === 'completed' || newStatus === 'abandoned';
    this.newResolvedAt = isResolved ? new Date().toISOString() : undefined;

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

    this.selectNode(this.nodeId, node.content.length);
    this.triggerAutosave?.();
    this.onStatusChange?.();
  }

  redo(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

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

    this.selectNode(this.nodeId, node.content.length);
    this.triggerAutosave?.();
    this.onStatusChange?.();
  }
}
