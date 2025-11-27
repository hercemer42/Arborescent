import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { addNodeToRegistry, removeNodeFromRegistry, AncestorRegistry } from '../../../services/ancestry';
import { createTreeNode } from '../../../utils/nodeHelpers';

/**
 * Command for creating a new node
 */
export class CreateNodeCommand extends BaseCommand {
  constructor(
    private newNodeId: string,
    private parentId: string,
    private position: number,
    private initialContent: string,
    private getState: () => {
      nodes: Record<string, TreeNode>;
      rootNodeId: string;
      ancestorRegistry: AncestorRegistry;
    },
    private setState: (partial: {
      nodes?: Record<string, TreeNode>;
      ancestorRegistry?: AncestorRegistry;
      activeNodeId?: string;
      cursorPosition?: number;
    }) => void,
    private triggerAutosave?: () => void
  ) {
    super();
    this.description = `Create node ${newNodeId}`;
  }

  execute(): void {
    const { nodes, ancestorRegistry } = this.getState();
    const parent = nodes[this.parentId];
    if (!parent) return;

    // Create the new node with default pending status
    const newNode = createTreeNode(this.newNodeId, {
      content: this.initialContent,
      metadata: { status: 'pending' },
    });

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

    // Incremental update: just add the new node
    const newAncestorRegistry = addNodeToRegistry(ancestorRegistry, this.newNodeId, this.parentId);

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      activeNodeId: this.newNodeId,
      cursorPosition: 0,
    });

    this.triggerAutosave?.();
  }

  undo(): void {
    const { nodes, ancestorRegistry } = this.getState();
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

    // Incremental update: remove the node (no descendants for a newly created node)
    const newAncestorRegistry = removeNodeFromRegistry(ancestorRegistry, this.newNodeId, nodes);

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
