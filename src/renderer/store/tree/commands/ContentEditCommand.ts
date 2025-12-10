import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';

export class ContentEditCommand extends BaseCommand {
  private oldContent: string;
  private newContent: string;

  constructor(
    private nodeId: string,
    private getNodes: () => Record<string, TreeNode>,
    private setNodes: (nodes: Record<string, TreeNode>) => void,
    oldContent: string,
    newContent: string,
    private selectNode: (nodeId: string, cursorPosition: number) => void,
    private triggerAutosave?: () => void
  ) {
    super();
    this.oldContent = oldContent;
    this.newContent = newContent;
    this.description = `Edit node ${nodeId}`;
  }

  execute(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    this.setNodes({
      ...nodes,
      [this.nodeId]: {
        ...node,
        content: this.newContent,
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
        content: this.oldContent,
      },
    });

    this.selectNode(this.nodeId, this.oldContent.length);
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
        content: this.newContent,
      },
    });

    this.selectNode(this.nodeId, this.newContent.length);
    this.triggerAutosave?.();
  }

  canMergeWith(other: unknown): boolean {
    if (!(other instanceof ContentEditCommand)) {
      return false;
    }

    if (other.nodeId !== this.nodeId) {
      return false;
    }

    if (other.oldContent !== this.newContent) {
      return false;
    }

    // Don't merge on whitespace changes - creates natural undo boundaries
    if (other.newContent.length > other.oldContent.length) {
      const lastChar = other.newContent[other.newContent.length - 1];
      if (/\s/.test(lastChar)) {
        return false;
      }
    } else if (other.newContent.length < other.oldContent.length) {
      const removed = other.oldContent.substring(other.newContent.length);
      if (/\s/.test(removed)) {
        return false;
      }
    }

    return true;
  }

  mergeWith(other: unknown): void {
    if (!(other instanceof ContentEditCommand)) {
      return;
    }

    this.newContent = other.newContent;
  }
}
