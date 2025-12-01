import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { updateNodeMetadata } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../services/ancestry';

interface BlueprintState {
  isBlueprint: boolean | undefined;
  blueprintIcon: string | undefined;
}

/**
 * Command for adding/removing nodes from blueprint
 */
export class BlueprintCommand extends BaseCommand {
  private previousStates: Map<string, BlueprintState> = new Map();
  private affectedNodeIds: string[] = [];

  constructor(
    private nodeId: string,
    private action: 'add' | 'remove',
    private cascade: boolean,
    private getNodes: () => Record<string, TreeNode>,
    private getRootNodeId: () => string,
    private getAncestorRegistry: () => AncestorRegistry,
    private setNodes: (nodes: Record<string, TreeNode>) => void,
    private triggerAutosave?: () => void
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

    if (this.action === 'add') {
      this.executeAdd(nodes);
    } else {
      this.executeRemove(nodes);
    }

    this.triggerAutosave?.();
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

    this.setNodes(updatedNodes);
  }

  private executeRemove(nodes: Record<string, TreeNode>): void {
    const rootNodeId = this.getRootNodeId();

    // Can't remove root from blueprint
    if (this.nodeId === rootNodeId) return;

    let updatedNodes = nodes;

    // Capture and update this node
    this.captureState(this.nodeId, nodes);
    updatedNodes = updateNodeMetadata(updatedNodes, this.nodeId, {
      isBlueprint: false,
      blueprintIcon: undefined,
    });
    this.affectedNodeIds.push(this.nodeId);

    // If cascade, also remove all descendants
    if (this.cascade) {
      updatedNodes = this.removeDescendants(this.nodeId, updatedNodes, nodes);
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
        this.captureState(childId, originalNodes);
        updatedNodes = updateNodeMetadata(updatedNodes, childId, {
          isBlueprint: false,
          blueprintIcon: undefined,
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
      });
    }
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
        });
      }
    }

    this.setNodes(updatedNodes);
    this.triggerAutosave?.();
  }

  redo(): void {
    this.execute();
  }
}
