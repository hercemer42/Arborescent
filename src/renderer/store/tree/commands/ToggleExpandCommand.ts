import { TreeNode } from '../../../../shared/types';

/**
 * Command to toggle a node's expanded/collapsed state
 */
export class ToggleExpandCommand {
  private oldExpanded: boolean;
  private newExpanded: boolean;

  constructor(
    private nodeId: string,
    private getNodes: () => Record<string, TreeNode>,
    private setNodes: (nodes: Record<string, TreeNode>) => void,
    private selectNode: (nodeId: string, cursorPosition: number) => void,
    private triggerAutosave?: () => void
  ) {
    this.oldExpanded = true; // Default value, will be captured in execute()
    this.newExpanded = true;
  }

  execute(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    // Only allow toggling if the node has children
    if (node.children.length === 0) return;

    // Capture old state
    this.oldExpanded = node.metadata?.expanded ?? true;

    // Calculate new state
    this.newExpanded = !this.oldExpanded;

    // Update node
    this.setNodes({
      ...nodes,
      [this.nodeId]: {
        ...node,
        metadata: {
          ...node.metadata,
          expanded: this.newExpanded,
        },
      },
    });

    this.triggerAutosave?.();
  }

  undo(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    // Restore old state
    this.setNodes({
      ...nodes,
      [this.nodeId]: {
        ...node,
        metadata: {
          ...node.metadata,
          expanded: this.oldExpanded,
        },
      },
    });

    // Select the node and place cursor at end
    this.selectNode(this.nodeId, node.content.length);

    this.triggerAutosave?.();
  }

  redo(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    // Restore new state
    this.setNodes({
      ...nodes,
      [this.nodeId]: {
        ...node,
        metadata: {
          ...node.metadata,
          expanded: this.newExpanded,
        },
      },
    });

    // Select the node and place cursor at end
    this.selectNode(this.nodeId, node.content.length);

    this.triggerAutosave?.();
  }

  canMergeWith(): boolean {
    // Never merge expand/collapse commands
    return false;
  }
}
