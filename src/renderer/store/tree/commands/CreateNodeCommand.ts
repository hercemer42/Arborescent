import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { addNodeToRegistry, removeNodeFromRegistry, AncestorRegistry } from '../../../services/ancestry';
import { createTreeNode, getIsContextChild } from '../../../utils/nodeHelpers';

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
    private triggerAutosave?: () => void,
    private initialMetadata?: Record<string, unknown>,
    private previousActiveNodeId?: string
  ) {
    super();
    this.description = `Create node ${newNodeId}`;
  }

  execute(): void {
    const { nodes, ancestorRegistry } = this.getState();
    const parent = nodes[this.parentId];
    if (!parent) return;

    // Build initial metadata
    const metadata: Record<string, unknown> = { status: 'pending', ...this.initialMetadata };

    // Only inherit blueprint status if parent is part of a context tree
    // (context declaration or context child) - regular blueprints don't auto-propagate
    const parentIsContextDeclaration = parent.metadata.isContextDeclaration === true;
    const parentIsContextChild = getIsContextChild(this.parentId, nodes, ancestorRegistry);
    if (parentIsContextDeclaration || parentIsContextChild) {
      metadata.isBlueprint = true;
    }

    // Create the new node with default pending status and any initial metadata
    const newNode = createTreeNode(this.newNodeId, {
      content: this.initialContent,
      metadata,
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

    // Return to the node we were in before creating, or fall back to parent
    const returnToNodeId = this.previousActiveNodeId && updatedNodes[this.previousActiveNodeId]
      ? this.previousActiveNodeId
      : this.parentId;
    const cursorPosition = updatedNodes[returnToNodeId].content.length;

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      activeNodeId: returnToNodeId,
      cursorPosition,
    });

    this.triggerAutosave?.();
  }
}
