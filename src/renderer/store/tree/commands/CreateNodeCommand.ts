import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { addNodeToRegistry, removeNodeFromRegistry, AncestorRegistry } from '../../../services/ancestry';
import { createTreeNode, shouldInheritBlueprint } from '../../../utils/nodeHelpers';

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

    const metadata: Record<string, unknown> = { status: 'pending', ...this.initialMetadata };

    if (shouldInheritBlueprint(this.parentId, nodes, ancestorRegistry)) {
      metadata.isBlueprint = true;
    }

    const newNode = createTreeNode(this.newNodeId, {
      content: this.initialContent,
      metadata,
    });

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

    const updatedChildren = parent.children.filter(id => id !== this.newNodeId);

    const updatedNodes = { ...nodes };
    delete updatedNodes[this.newNodeId];

    updatedNodes[this.parentId] = {
      ...parent,
      children: updatedChildren,
    };

    const newAncestorRegistry = removeNodeFromRegistry(ancestorRegistry, this.newNodeId, nodes);

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
