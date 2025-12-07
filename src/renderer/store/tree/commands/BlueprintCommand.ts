import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { updateNodeMetadata } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../services/ancestry';

interface BlueprintState {
  isBlueprint: boolean | undefined;
  blueprintIcon: string | undefined;
  blueprintColor: string | undefined;
  // Context-related fields
  isContextDeclaration: boolean | undefined;
  bundledContextIds: string[] | undefined;
}

/**
 * Command for adding/removing nodes from blueprint
 */
export class BlueprintCommand extends BaseCommand {
  private previousStates: Map<string, BlueprintState> = new Map();
  private affectedNodeIds: string[] = [];
  private removedContextDeclarationIds: string[] = [];

  constructor(
    private nodeId: string,
    private action: 'add' | 'remove',
    private cascade: boolean,
    private getNodes: () => Record<string, TreeNode>,
    private getRootNodeId: () => string,
    private getAncestorRegistry: () => AncestorRegistry,
    private setNodes: (nodes: Record<string, TreeNode>) => void,
    private triggerAutosave?: () => void,
    private refreshContextDeclarations?: () => void
  ) {
    super();
    this.description = `${action === 'add' ? 'Add to' : 'Remove from'} blueprint ${nodeId}`;
  }

  execute(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    // Clear previous state tracking
    this.previousStates.clear();
    this.affectedNodeIds = [];
    this.removedContextDeclarationIds = [];

    if (this.action === 'add') {
      this.executeAdd(nodes);
    } else {
      this.executeRemove(nodes);
    }

    this.triggerAutosave?.();

    // If any context declarations were removed, refresh the declarations list
    if (this.removedContextDeclarationIds.length > 0) {
      this.refreshContextDeclarations?.();
    }
  }

  private executeAdd(nodes: Record<string, TreeNode>): void {
    const ancestorRegistry = this.getAncestorRegistry();
    let updatedNodes = nodes;

    // Capture and update this node
    this.captureState(this.nodeId, nodes);
    updatedNodes = updateNodeMetadata(updatedNodes, this.nodeId, {
      isBlueprint: true,
    });
    this.affectedNodeIds.push(this.nodeId);

    // Paint-up: mark all ancestors as blueprints
    const ancestors = ancestorRegistry[this.nodeId] || [];
    for (const ancestorId of ancestors) {
      const ancestor = updatedNodes[ancestorId];
      if (ancestor && ancestor.metadata.isBlueprint !== true) {
        this.captureState(ancestorId, nodes);
        updatedNodes = updateNodeMetadata(updatedNodes, ancestorId, {
          isBlueprint: true,
        });
        this.affectedNodeIds.push(ancestorId);
      }
    }

    // If cascade, also add all descendants
    if (this.cascade) {
      updatedNodes = this.addDescendants(this.nodeId, updatedNodes, nodes);
    }

    this.setNodes(updatedNodes);
  }

  private addDescendants(
    nodeId: string,
    updatedNodes: Record<string, TreeNode>,
    originalNodes: Record<string, TreeNode>
  ): Record<string, TreeNode> {
    const node = updatedNodes[nodeId];
    if (!node) return updatedNodes;

    for (const childId of node.children) {
      const child = updatedNodes[childId];
      if (child && child.metadata.isBlueprint !== true) {
        this.captureState(childId, originalNodes);
        updatedNodes = updateNodeMetadata(updatedNodes, childId, {
          isBlueprint: true,
        });
        this.affectedNodeIds.push(childId);
      }
      updatedNodes = this.addDescendants(childId, updatedNodes, originalNodes);
    }

    return updatedNodes;
  }

  private executeRemove(nodes: Record<string, TreeNode>): void {
    const rootNodeId = this.getRootNodeId();

    // Can't remove root from blueprint
    if (this.nodeId === rootNodeId) return;

    let updatedNodes = nodes;
    const node = updatedNodes[this.nodeId];

    // Track if this node is a context declaration
    if (node?.metadata.isContextDeclaration === true) {
      this.removedContextDeclarationIds.push(this.nodeId);
    }

    // Capture and update this node - clear blueprint and context metadata
    this.captureState(this.nodeId, nodes);
    updatedNodes = updateNodeMetadata(updatedNodes, this.nodeId, {
      isBlueprint: false,
      blueprintIcon: undefined,
      blueprintColor: undefined,
      isContextDeclaration: false,
      bundledContextIds: undefined,
    });
    this.affectedNodeIds.push(this.nodeId);

    // If cascade, also remove all descendants
    if (this.cascade) {
      updatedNodes = this.removeDescendants(this.nodeId, updatedNodes, nodes);
    }

    // Clean up any references to removed context declarations from all nodes
    if (this.removedContextDeclarationIds.length > 0) {
      updatedNodes = this.removeContextFromAllNodes(updatedNodes);
    }

    this.setNodes(updatedNodes);
  }

  private removeDescendants(
    nodeId: string,
    updatedNodes: Record<string, TreeNode>,
    originalNodes: Record<string, TreeNode>
  ): Record<string, TreeNode> {
    const node = updatedNodes[nodeId];
    if (!node) return updatedNodes;

    for (const childId of node.children) {
      const child = updatedNodes[childId];
      if (child && child.metadata.isBlueprint === true) {
        // Track if this child is a context declaration
        if (child.metadata.isContextDeclaration === true) {
          this.removedContextDeclarationIds.push(childId);
        }

        this.captureState(childId, originalNodes);
        updatedNodes = updateNodeMetadata(updatedNodes, childId, {
          isBlueprint: false,
          blueprintIcon: undefined,
          blueprintColor: undefined,
          isContextDeclaration: false,
          bundledContextIds: undefined,
        });
        this.affectedNodeIds.push(childId);
        updatedNodes = this.removeDescendants(childId, updatedNodes, originalNodes);
      }
    }

    return updatedNodes;
  }

  private captureState(nodeId: string, nodes: Record<string, TreeNode>): void {
    const node = nodes[nodeId];
    if (node && !this.previousStates.has(nodeId)) {
      this.previousStates.set(nodeId, {
        isBlueprint: node.metadata.isBlueprint as boolean | undefined,
        blueprintIcon: node.metadata.blueprintIcon as string | undefined,
        blueprintColor: node.metadata.blueprintColor as string | undefined,
        isContextDeclaration: node.metadata.isContextDeclaration as boolean | undefined,
        bundledContextIds: node.metadata.bundledContextIds as string[] | undefined,
      });
    }
  }

  /**
   * Remove deleted context declarations from appliedContextIds and bundledContextIds
   * of all nodes in the tree.
   */
  private removeContextFromAllNodes(nodes: Record<string, TreeNode>): Record<string, TreeNode> {
    let updatedNodes = nodes;

    for (const node of Object.values(nodes)) {
      const appliedContextIds = (node.metadata.appliedContextIds as string[]) || [];
      const bundledContextIds = (node.metadata.bundledContextIds as string[]) || [];
      const activeContextId = node.metadata.activeContextId as string | undefined;

      let needsUpdate = false;
      const metadataUpdates: Record<string, unknown> = {};

      // Filter out removed contexts from appliedContextIds
      const newAppliedIds = appliedContextIds.filter(
        id => !this.removedContextDeclarationIds.includes(id)
      );
      if (newAppliedIds.length !== appliedContextIds.length) {
        needsUpdate = true;
        metadataUpdates.appliedContextIds = newAppliedIds.length > 0 ? newAppliedIds : undefined;

        // Handle activeContextId
        if (newAppliedIds.length === 0) {
          metadataUpdates.activeContextId = undefined;
        } else if (activeContextId && this.removedContextDeclarationIds.includes(activeContextId)) {
          // Promote first remaining context to active
          metadataUpdates.activeContextId = newAppliedIds[0];
        }
      }

      // Filter out removed contexts from bundledContextIds
      const newBundledIds = bundledContextIds.filter(
        id => !this.removedContextDeclarationIds.includes(id)
      );
      if (newBundledIds.length !== bundledContextIds.length) {
        needsUpdate = true;
        metadataUpdates.bundledContextIds = newBundledIds.length > 0 ? newBundledIds : undefined;
      }

      if (needsUpdate) {
        // Capture state for this node if not already captured
        if (!this.previousStates.has(node.id)) {
          this.captureState(node.id, nodes);
          this.affectedNodeIds.push(node.id);
        }
        updatedNodes = updateNodeMetadata(updatedNodes, node.id, metadataUpdates);
      }
    }

    return updatedNodes;
  }

  undo(): void {
    const nodes = this.getNodes();
    let updatedNodes = nodes;

    // Restore all affected nodes to their previous states
    for (const nodeId of this.affectedNodeIds) {
      const previousState = this.previousStates.get(nodeId);
      if (previousState) {
        updatedNodes = updateNodeMetadata(updatedNodes, nodeId, {
          isBlueprint: previousState.isBlueprint,
          blueprintIcon: previousState.blueprintIcon,
          blueprintColor: previousState.blueprintColor,
          isContextDeclaration: previousState.isContextDeclaration,
          bundledContextIds: previousState.bundledContextIds,
        });
      }
    }

    this.setNodes(updatedNodes);
    this.triggerAutosave?.();

    // If context declarations were removed, refresh after undo restores them
    if (this.removedContextDeclarationIds.length > 0) {
      this.refreshContextDeclarations?.();
    }
  }

  redo(): void {
    this.execute();
  }
}
