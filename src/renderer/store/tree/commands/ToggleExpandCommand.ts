import { TreeNode } from '../../../../shared/types';

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

    if (node.children.length === 0) return;

    this.oldExpanded = node.metadata?.expanded ?? true;
    this.newExpanded = !this.oldExpanded;

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

    this.selectNode(this.nodeId, node.content.length);

    this.triggerAutosave?.();
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
          expanded: this.newExpanded,
        },
      },
    });

    this.selectNode(this.nodeId, node.content.length);

    this.triggerAutosave?.();
  }

  canMergeWith(): boolean {
    return false;
  }
}
