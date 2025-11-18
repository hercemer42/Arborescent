import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { buildAncestorRegistry } from '../../../utils/ancestry';

/**
 * Command for creating a new node
 */
export class CreateNodeCommand extends BaseCommand {
  constructor(
    private newNodeId: string,
    private parentId: string,
    private position: number,
    private initialContent: string,
    private getState: () => { nodes: Record<string, TreeNode>; rootNodeId: string },
    private setState: (partial: {
      nodes?: Record<string, TreeNode>;
      ancestorRegistry?: Record<string, string[]>;
      activeNodeId?: string;
      cursorPosition?: number;
    }) => void,
    private triggerAutosave?: () => void
  ) {
    super();
    this.description = `Create node ${newNodeId}`;
  }

  execute(): void {
    const { nodes, rootNodeId } = this.getState();
    const parent = nodes[this.parentId];
    if (!parent) return;

    // Create the new node with default pending status
    const newNode: TreeNode = {
      id: this.newNodeId,
      content: this.initialContent,
      children: [],
      metadata: { status: 'pending' },
    };

    // Insert into parent's children
    const updatedChildren = [...parent.children];
    updatedChildren.splice(this.position, 0, this.newNodeId);

    const updatedNodes = {
      ...nodes,
      [this.newNodeId]: newNode,
      [this.parentId]: {
        ...parent,
        children: updatedChildren,
      },
    };

    const newAncestorRegistry = buildAncestorRegistry(rootNodeId, updatedNodes);

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      activeNodeId: this.newNodeId,
      cursorPosition: 0,
    });

    this.triggerAutosave?.();
  }

  undo(): void {
    const { nodes, rootNodeId } = this.getState();
    const parent = nodes[this.parentId];
    if (!parent) return;

    // Remove from parent's children
    const updatedChildren = parent.children.filter(id => id !== this.newNodeId);

    // Remove the node
    const updatedNodes = { ...nodes };
    delete updatedNodes[this.newNodeId];

    updatedNodes[this.parentId] = {
      ...parent,
      children: updatedChildren,
    };

    const newAncestorRegistry = buildAncestorRegistry(rootNodeId, updatedNodes);

    // Place cursor at end of parent's content
    const cursorPosition = updatedNodes[this.parentId].content.length;

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      activeNodeId: this.parentId,
      cursorPosition,
    });

    this.triggerAutosave?.();
  }
}
