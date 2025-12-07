import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { moveNodeInRegistry, AncestorRegistry } from '../../../services/ancestry';
import { getIsContextChild, getAllDescendants, updateNodeMetadata } from '../../../utils/nodeHelpers';

/**
 * Command for moving a node to a new parent/position
 * This handles drag-drop, indent, outdent
 */
export class MoveNodeCommand extends BaseCommand {
  private oldParentId: string | null = null;
  private oldPosition: number = -1;
  private previousBlueprintStates: Map<string, boolean | undefined> = new Map();

  constructor(
    private nodeId: string,
    private newParentId: string,
    private newPosition: number,
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

    // Clear previous blueprint states
    this.previousBlueprintStates.clear();

    // Perform the move
    let updatedNodes = { ...nodes };

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

    // Inherit blueprint status only when moving into a context tree
    const parentIsContextDeclaration = newParent.metadata.isContextDeclaration === true;
    const parentIsContextChild = getIsContextChild(this.newParentId, nodes, ancestorRegistry);
    if (parentIsContextDeclaration || parentIsContextChild) {
      updatedNodes = this.inheritBlueprintStatus(updatedNodes, this.nodeId, nodes);
    }

    // Incremental update: update ancestors for moved node and descendants
    const newAncestorRegistry = moveNodeInRegistry(
      ancestorRegistry,
      this.nodeId,
      this.newParentId,
      updatedNodes
    );

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

  private inheritBlueprintStatus(
    nodes: Record<string, TreeNode>,
    nodeId: string,
    originalNodes: Record<string, TreeNode>
  ): Record<string, TreeNode> {
    let updatedNodes = nodes;
    const nodeIdsToUpdate = [nodeId, ...getAllDescendants(nodeId, nodes)];

    for (const id of nodeIdsToUpdate) {
      const n = updatedNodes[id];
      if (!n || n.metadata.isBlueprint === true) continue;

      const original = originalNodes[id];
      if (original) {
        this.previousBlueprintStates.set(id, original.metadata.isBlueprint as boolean | undefined);
      }

      updatedNodes = updateNodeMetadata(updatedNodes, id, { isBlueprint: true });
    }

    return updatedNodes;
  }

  undo(): void {
    if (this.oldParentId === null || this.oldPosition === -1) return;

    const { nodes, ancestorRegistry } = this.getState();

    // Move back to old position
    let updatedNodes = { ...nodes };

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

    // Restore blueprint status for nodes that were modified
    for (const [nodeId, previousState] of this.previousBlueprintStates) {
      updatedNodes = updateNodeMetadata(updatedNodes, nodeId, { isBlueprint: previousState });
    }

    // Incremental update: update ancestors for moved node and descendants
    const newAncestorRegistry = moveNodeInRegistry(
      ancestorRegistry,
      this.nodeId,
      this.oldParentId,
      updatedNodes
    );

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
