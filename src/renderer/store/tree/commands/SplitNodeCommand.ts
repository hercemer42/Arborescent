import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { addNodeToRegistry, removeNodeFromRegistry, AncestorRegistry } from '../../../services/ancestry';
import { createTreeNode, getIsContextChild } from '../../../utils/nodeHelpers';

/**
 * Command for splitting a node at the cursor position.
 * Content before cursor stays in original node, content after moves to new sibling.
 */
export class SplitNodeCommand extends BaseCommand {
  constructor(
    private sourceNodeId: string,
    private newNodeId: string,
    private originalContent: string,
    private contentBefore: string,
    private contentAfter: string,
    private originalCursorPosition: number,
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
    this.description = `Split node ${sourceNodeId}`;
  }

  execute(): void {
    const { nodes, ancestorRegistry, rootNodeId } = this.getState();
    const sourceNode = nodes[this.sourceNodeId];
    if (!sourceNode) return;

    // Find parent of source node
    const ancestors = ancestorRegistry[this.sourceNodeId] || [];
    const parentId = ancestors[ancestors.length - 1] || rootNodeId;
    const parent = nodes[parentId];
    if (!parent) return;

    // Find position after source node in parent's children
    const sourceIndex = parent.children.indexOf(this.sourceNodeId);
    const newPosition = sourceIndex + 1;

    // Build metadata for new node
    const metadata: Record<string, unknown> = { status: 'pending' };

    // Inherit blueprint status if parent is part of a context tree
    const parentIsContextDeclaration = parent.metadata.isContextDeclaration === true;
    const parentIsContextChild = getIsContextChild(parentId, nodes, ancestorRegistry);
    if (parentIsContextDeclaration || parentIsContextChild) {
      metadata.isBlueprint = true;
    }

    // Create new node with content after cursor
    const newNode = createTreeNode(this.newNodeId, {
      content: this.contentAfter,
      metadata,
    });

    // Update parent's children to include new node
    const updatedChildren = [...parent.children];
    updatedChildren.splice(newPosition, 0, this.newNodeId);

    // Update source node with content before cursor
    const updatedSourceNode = {
      ...sourceNode,
      content: this.contentBefore,
    };

    const updatedNodes = {
      ...nodes,
      [this.sourceNodeId]: updatedSourceNode,
      [this.newNodeId]: newNode,
      [parentId]: {
        ...parent,
        children: updatedChildren,
      },
    };

    // Add new node to ancestry registry
    const newAncestorRegistry = addNodeToRegistry(ancestorRegistry, this.newNodeId, parentId);

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      activeNodeId: this.newNodeId,
      cursorPosition: 0,
    });

    this.triggerAutosave?.();
  }

  undo(): void {
    const { nodes, ancestorRegistry, rootNodeId } = this.getState();
    const sourceNode = nodes[this.sourceNodeId];
    const newNode = nodes[this.newNodeId];
    if (!sourceNode || !newNode) return;

    // Find parent
    const ancestors = ancestorRegistry[this.sourceNodeId] || [];
    const parentId = ancestors[ancestors.length - 1] || rootNodeId;
    const parent = nodes[parentId];
    if (!parent) return;

    // Remove new node from parent's children
    const updatedChildren = parent.children.filter(id => id !== this.newNodeId);

    // Restore source node's original content
    const restoredSourceNode = {
      ...sourceNode,
      content: this.originalContent,
    };

    // Remove new node from nodes
    const updatedNodes = { ...nodes };
    delete updatedNodes[this.newNodeId];

    updatedNodes[this.sourceNodeId] = restoredSourceNode;
    updatedNodes[parentId] = {
      ...parent,
      children: updatedChildren,
    };

    // Remove new node from ancestry registry
    const newAncestorRegistry = removeNodeFromRegistry(ancestorRegistry, this.newNodeId, nodes);

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: newAncestorRegistry,
      activeNodeId: this.sourceNodeId,
      cursorPosition: this.originalCursorPosition,
    });

    this.triggerAutosave?.();
  }
}
