import { BaseCommand } from './Command';
import { TreeNode, NodeStatus } from '../../../../shared/types';

/**
 * Command for toggling node task status
 */
export class ToggleStatusCommand extends BaseCommand {
  private oldStatus: NodeStatus | undefined;
  private newStatus: NodeStatus | undefined;

  constructor(
    private nodeId: string,
    private getNodes: () => Record<string, TreeNode>,
    private setNodes: (nodes: Record<string, TreeNode>) => void,
    private selectNode: (nodeId: string, cursorPosition: number) => void,
    private triggerAutosave?: () => void
  ) {
    super();
    this.description = `Toggle status ${nodeId}`;
  }

  execute(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    // Capture old status
    this.oldStatus = node.metadata?.status as NodeStatus | undefined;

    // Calculate new status
    const currentStatus = node.metadata?.status;
    let newStatus: NodeStatus | undefined;

    if (!currentStatus || currentStatus === 'pending') {
      newStatus = 'completed';
    } else if (currentStatus === 'completed') {
      newStatus = 'failed';
    } else {
      newStatus = 'pending';
    }

    this.newStatus = newStatus;

    // Update node
    this.setNodes({
      ...nodes,
      [this.nodeId]: {
        ...node,
        metadata: {
          ...node.metadata,
          status: newStatus,
        },
      },
    });

    this.triggerAutosave?.();
  }

  undo(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    // Restore old status
    this.setNodes({
      ...nodes,
      [this.nodeId]: {
        ...node,
        metadata: {
          ...node.metadata,
          status: this.oldStatus,
        },
      },
    });

    // Select node and place cursor at end
    this.selectNode(this.nodeId, node.content.length);
    this.triggerAutosave?.();
  }

  redo(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    // Apply new status
    this.setNodes({
      ...nodes,
      [this.nodeId]: {
        ...node,
        metadata: {
          ...node.metadata,
          status: this.newStatus,
        },
      },
    });

    // Select node and place cursor at end
    this.selectNode(this.nodeId, node.content.length);
    this.triggerAutosave?.();
  }
}
