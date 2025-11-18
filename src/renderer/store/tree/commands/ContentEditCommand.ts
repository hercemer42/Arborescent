import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';

/**
 * Command for editing node content
 * Supports merging consecutive edits for better UX
 */
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

    // Don't set cursor during normal execution - browser handles it naturally
    // Cursor position is only set during undo/redo
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

    // Select this node and place cursor at end of old content
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

    // Select this node and place cursor at end of new content
    this.selectNode(this.nodeId, this.newContent.length);
    this.triggerAutosave?.();
  }

  canMergeWith(other: unknown): boolean {
    if (!(other instanceof ContentEditCommand)) {
      return false;
    }

    // Only merge if editing the same node
    if (other.nodeId !== this.nodeId) {
      return false;
    }

    // Only merge if the old content of the new command matches our new content
    // This ensures we're continuing from where we left off
    if (other.oldContent !== this.newContent) {
      return false;
    }

    // Don't merge if a space was just added or removed
    // Contenteditable inserts &nbsp; (char 160) not regular space (char 32)
    // Use regex to catch all whitespace characters
    if (other.newContent.length > other.oldContent.length) {
      // Something was added
      const lastChar = other.newContent[other.newContent.length - 1];
      if (/\s/.test(lastChar)) {
        return false; // Whitespace added - new undo step
      }
    } else if (other.newContent.length < other.oldContent.length) {
      // Something was removed - check if any removed characters were whitespace
      const removed = other.oldContent.substring(other.newContent.length);
      if (/\s/.test(removed)) {
        return false; // Whitespace removed - new undo step
      }
    }

    return true;
  }

  mergeWith(other: unknown): void {
    if (!(other instanceof ContentEditCommand)) {
      return;
    }

    // Update our new content to be the final state from the merged command
    this.newContent = other.newContent;
  }
}
