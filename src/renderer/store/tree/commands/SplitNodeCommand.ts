import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { addNodeToRegistry, removeNodeFromRegistry, AncestorRegistry } from '../../../services/ancestry';
import { createTreeNode, shouldInheritBlueprint } from '../../../utils/nodeHelpers';

type State = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
};

type SetState = (partial: {
  nodes?: Record<string, TreeNode>;
  ancestorRegistry?: AncestorRegistry;
  activeNodeId?: string;
  cursorPosition?: number;
}) => void;

export class SplitNodeCommand extends BaseCommand {
  constructor(
    private sourceNodeId: string,
    private newNodeId: string,
    private originalContent: string,
    private contentBefore: string,
    private contentAfter: string,
    private originalCursorPosition: number,
    private getState: () => State,
    private setState: SetState,
    private triggerAutosave?: () => void,
    private createAsChild: boolean = false
  ) {
    super();
    this.description = `Split node ${sourceNodeId}`;
  }

  private getTargetParentId(ancestorRegistry: AncestorRegistry, rootNodeId: string): string {
    if (this.createAsChild) {
      return this.sourceNodeId;
    }
    const ancestors = ancestorRegistry[this.sourceNodeId] || [];
    return ancestors[ancestors.length - 1] || rootNodeId;
  }

  private getInsertPosition(nodes: Record<string, TreeNode>, targetParentId: string): number {
    if (this.createAsChild) {
      return 0;
    }
    const parent = nodes[targetParentId];
    return parent ? parent.children.indexOf(this.sourceNodeId) + 1 : 0;
  }

  execute(): void {
    const { nodes, ancestorRegistry, rootNodeId } = this.getState();
    const sourceNode = nodes[this.sourceNodeId];
    if (!sourceNode) return;

    const targetParentId = this.getTargetParentId(ancestorRegistry, rootNodeId);
    const targetParent = nodes[targetParentId];
    if (!targetParent) return;

    const newPosition = this.getInsertPosition(nodes, targetParentId);
    const metadata: Record<string, unknown> = { status: 'pending' };
    if (shouldInheritBlueprint(targetParentId, nodes, ancestorRegistry)) {
      metadata.isBlueprint = true;
    }
    const newNode = createTreeNode(this.newNodeId, { content: this.contentAfter, metadata });

    const updatedChildren = [...targetParent.children];
    updatedChildren.splice(newPosition, 0, this.newNodeId);

    const updatedNodes: Record<string, TreeNode> = {
      ...nodes,
      [this.newNodeId]: newNode,
      [this.sourceNodeId]: {
        ...sourceNode,
        content: this.contentBefore,
        ...(this.createAsChild && { children: updatedChildren }),
      },
    };

    if (!this.createAsChild) {
      updatedNodes[targetParentId] = { ...targetParent, children: updatedChildren };
    }

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: addNodeToRegistry(ancestorRegistry, this.newNodeId, targetParentId),
      activeNodeId: this.newNodeId,
      cursorPosition: 0,
    });
    this.triggerAutosave?.();
  }

  undo(): void {
    const { nodes, ancestorRegistry, rootNodeId } = this.getState();
    const sourceNode = nodes[this.sourceNodeId];
    if (!sourceNode || !nodes[this.newNodeId]) return;

    const targetParentId = this.getTargetParentId(ancestorRegistry, rootNodeId);
    const targetParent = nodes[targetParentId];
    if (!targetParent) return;

    const updatedChildren = targetParent.children.filter(id => id !== this.newNodeId);
    const updatedNodes: Record<string, TreeNode> = { ...nodes };
    delete updatedNodes[this.newNodeId];

    updatedNodes[this.sourceNodeId] = {
      ...sourceNode,
      content: this.originalContent,
      ...(this.createAsChild && { children: updatedChildren }),
    };

    if (!this.createAsChild) {
      updatedNodes[targetParentId] = { ...targetParent, children: updatedChildren };
    }

    this.setState({
      nodes: updatedNodes,
      ancestorRegistry: removeNodeFromRegistry(ancestorRegistry, this.newNodeId, nodes),
      activeNodeId: this.sourceNodeId,
      cursorPosition: this.originalCursorPosition,
    });
    this.triggerAutosave?.();
  }
}
