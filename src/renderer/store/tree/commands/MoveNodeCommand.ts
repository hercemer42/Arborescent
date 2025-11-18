import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { buildAncestorRegistry } from '../../../utils/ancestry';

/**
 * Command for moving a node to a new parent/position
 * This handles drag-drop, indent, outdent
 */
export class MoveNodeCommand extends BaseCommand {
  private oldParentId: string | null = null;
  private oldPosition: number = -1;

  constructor(
    private nodeId: string,
    private newParentId: string,
    private newPosition: number,
    private getState: () => {
      nodes: Record<string, TreeNode>;
      rootNodeId: string;
      ancestorRegistry: Record<string, string[]>;
    },
    private setState: (partial: {
      nodes?: Record<string, TreeNode>;
      ancestorRegistry?: Record<string, string[]>;
      activeNodeId?: string;
      cursorPosition?: number;
    }) => void,
    private triggerAutosave?: () => void
  ) {
    super();
    this.description = `Move node ${nodeId}`;
  }

  execute(): void {
    const { nodes, rootNodeId, ancestorRegistry } = this.getState();
    const node = nodes[this.nodeId];
    if (!node) return;

    // Capture old position
    const ancestors = ancestorRegistry[this.nodeId] || [];
    this.oldParentId = ancestors[ancestors.length - 1] || rootNodeId;
    const oldParent = nodes[this.oldParentId];
    if (!oldParent) return;

    this.oldPosition = oldParent.children.indexOf(this.nodeId);

    // Perform the move
    const updatedNodes = { ...nodes };

    // Remove from old parent
    updatedNodes[this.oldParentId] = {
      ...oldParent,
      children: oldParent.children.filter(id => id !== this.nodeId),
    };

    // Add to new parent
    const newParent = updatedNodes[this.newParentId];
    if (!newParent) return;

    const newChildren = [...newParent.children];
    newChildren.splice(this.newPosition, 0, this.nodeId);

    updatedNodes[this.newParentId] = {
      ...newParent,
      children: newChildren,
    };

    const newAncestorRegistry = buildAncestorRegistry(rootNodeId, updatedNodes);

    // Select the moved node and place cursor at end of its content
    const movedNode = updatedNodes[this.nodeId];
    const cursorPosition = movedNode ? movedNode.content.length : 0;

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      activeNodeId: this.nodeId,
      cursorPosition,
    });

    this.triggerAutosave?.();
  }

  undo(): void {
    if (this.oldParentId === null || this.oldPosition === -1) return;

    const { nodes, rootNodeId } = this.getState();

    // Move back to old position
    const updatedNodes = { ...nodes };

    // Remove from current parent
    const currentParent = updatedNodes[this.newParentId];
    if (!currentParent) return;

    updatedNodes[this.newParentId] = {
      ...currentParent,
      children: currentParent.children.filter(id => id !== this.nodeId),
    };

    // Add back to old parent
    const oldParent = updatedNodes[this.oldParentId];
    if (!oldParent) return;

    const oldChildren = [...oldParent.children];
    oldChildren.splice(this.oldPosition, 0, this.nodeId);

    updatedNodes[this.oldParentId] = {
      ...oldParent,
      children: oldChildren,
    };

    const newAncestorRegistry = buildAncestorRegistry(rootNodeId, updatedNodes);

    // Select the moved node and place cursor at end of its content
    const movedNode = updatedNodes[this.nodeId];
    const cursorPosition = movedNode ? movedNode.content.length : 0;

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      activeNodeId: this.nodeId,
      cursorPosition,
    });

    this.triggerAutosave?.();
  }
}
