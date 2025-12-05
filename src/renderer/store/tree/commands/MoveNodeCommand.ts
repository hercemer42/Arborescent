import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { moveNodeInRegistry, AncestorRegistry } from '../../../services/ancestry';
import { getContextDeclarationId, getAllDescendants, updateNodeMetadata } from '../../../utils/nodeHelpers';

/**
 * Command for moving a node to a new parent/position
 * This handles drag-drop, indent, outdent
 */
export class MoveNodeCommand extends BaseCommand {
  private oldParentId: string | null = null;
  private oldPosition: number = -1;
  private oldContextDeclarationId: string | undefined = undefined;
  private previousContextStates: Map<string, {
    isContextChild: boolean | undefined;
    contextParentId: string | undefined;
    isBlueprint: boolean | undefined;
  }> = new Map();

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

    // Capture old context declaration ID for the moved node (before move)
    this.oldContextDeclarationId = getContextDeclarationId(node);

    // Clear previous context states
    this.previousContextStates.clear();

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

    // Update context metadata based on new parent
    const newContextDeclarationId = getContextDeclarationId(newParent);
    updatedNodes = this.updateContextMetadata(
      updatedNodes,
      this.nodeId,
      newContextDeclarationId
    );

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

  /**
   * Update context metadata for a moved node and its descendants.
   * Skip nodes that are context declarations themselves (they maintain their own context).
   */
  private updateContextMetadata(
    nodes: Record<string, TreeNode>,
    nodeId: string,
    newContextDeclarationId: string | undefined
  ): Record<string, TreeNode> {
    let updatedNodes = nodes;
    const node = nodes[nodeId];
    if (!node) return updatedNodes;

    // Get all nodes to update (moved node + descendants, excluding context declarations)
    const nodeIdsToUpdate = [nodeId, ...getAllDescendants(nodeId, nodes)].filter(id => {
      const n = nodes[id];
      // Skip if this is a context declaration - it keeps its own context
      return n && n.metadata.isContextDeclaration !== true;
    });

    for (const id of nodeIdsToUpdate) {
      const n = updatedNodes[id];
      if (!n) continue;

      // Capture previous state for undo
      this.previousContextStates.set(id, {
        isContextChild: n.metadata.isContextChild as boolean | undefined,
        contextParentId: n.metadata.contextParentId as string | undefined,
        isBlueprint: n.metadata.isBlueprint as boolean | undefined,
      });

      if (newContextDeclarationId) {
        // Moving into a context tree
        updatedNodes = updateNodeMetadata(updatedNodes, id, {
          isBlueprint: true,
          isContextChild: true,
          contextParentId: newContextDeclarationId,
        });
      } else {
        // Moving out of a context tree
        updatedNodes = updateNodeMetadata(updatedNodes, id, {
          isContextChild: false,
          contextParentId: undefined,
          // Note: we don't clear isBlueprint - that's managed by blueprint actions
        });
      }
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

    // Restore context metadata for all affected nodes
    for (const [nodeId, previousState] of this.previousContextStates) {
      updatedNodes = updateNodeMetadata(updatedNodes, nodeId, {
        isContextChild: previousState.isContextChild,
        contextParentId: previousState.contextParentId,
        isBlueprint: previousState.isBlueprint,
      });
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
