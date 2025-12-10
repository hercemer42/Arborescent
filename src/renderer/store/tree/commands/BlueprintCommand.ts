import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { updateNodeMetadata } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../services/ancestry';

interface BlueprintState {
  isBlueprint: boolean | undefined;
  blueprintIcon: string | undefined;
  blueprintColor: string | undefined;
  isContextDeclaration: boolean | undefined;
  appliedContextId: string | undefined;
}

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

    this.previousStates.clear();
    this.affectedNodeIds = [];
    this.removedContextDeclarationIds = [];

    if (this.action === 'add') {
      this.executeAdd(nodes);
    } else {
      this.executeRemove(nodes);
    }

    this.triggerAutosave?.();

    if (this.removedContextDeclarationIds.length > 0) {
      this.refreshContextDeclarations?.();
    }
  }

  private executeAdd(nodes: Record<string, TreeNode>): void {
    const ancestorRegistry = this.getAncestorRegistry();
    let updatedNodes = nodes;

    this.captureState(this.nodeId, nodes);
    updatedNodes = updateNodeMetadata(updatedNodes, this.nodeId, {
      isBlueprint: true,
    });
    this.affectedNodeIds.push(this.nodeId);

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

    if (this.nodeId === rootNodeId) return;

    let updatedNodes = nodes;
    const node = updatedNodes[this.nodeId];

    if (node?.metadata.isContextDeclaration === true) {
      this.removedContextDeclarationIds.push(this.nodeId);
    }

    this.captureState(this.nodeId, nodes);
    updatedNodes = updateNodeMetadata(updatedNodes, this.nodeId, {
      isBlueprint: false,
      blueprintIcon: undefined,
      blueprintColor: undefined,
      isContextDeclaration: false,
      appliedContextId: undefined,
    });
    this.affectedNodeIds.push(this.nodeId);

    if (this.cascade) {
      updatedNodes = this.removeDescendants(this.nodeId, updatedNodes, nodes);
    }

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
        if (child.metadata.isContextDeclaration === true) {
          this.removedContextDeclarationIds.push(childId);
        }

        this.captureState(childId, originalNodes);
        updatedNodes = updateNodeMetadata(updatedNodes, childId, {
          isBlueprint: false,
          blueprintIcon: undefined,
          blueprintColor: undefined,
          isContextDeclaration: false,
          appliedContextId: undefined,
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
        appliedContextId: node.metadata.appliedContextId as string | undefined,
      });
    }
  }

  private removeContextFromAllNodes(nodes: Record<string, TreeNode>): Record<string, TreeNode> {
    let updatedNodes = nodes;

    for (const node of Object.values(nodes)) {
      const appliedContextIds = (node.metadata.appliedContextIds as string[]) || [];
      const activeContextId = node.metadata.activeContextId as string | undefined;
      const appliedContextId = node.metadata.appliedContextId as string | undefined;

      const hasRemovedAppliedIds = appliedContextIds.some(
        id => this.removedContextDeclarationIds.includes(id)
      );
      const hasRemovedAppliedContextId = appliedContextId && this.removedContextDeclarationIds.includes(appliedContextId);

      if (!hasRemovedAppliedIds && !hasRemovedAppliedContextId) {
        continue;
      }

      const metadataUpdates: Record<string, unknown> = {};

      if (hasRemovedAppliedIds) {
        const newAppliedIds = appliedContextIds.filter(
          id => !this.removedContextDeclarationIds.includes(id)
        );
        metadataUpdates.appliedContextIds = newAppliedIds.length > 0 ? newAppliedIds : undefined;

        if (newAppliedIds.length === 0) {
          metadataUpdates.activeContextId = undefined;
        } else if (activeContextId && this.removedContextDeclarationIds.includes(activeContextId)) {
          metadataUpdates.activeContextId = newAppliedIds[0];
        }
      }

      if (hasRemovedAppliedContextId) {
        metadataUpdates.appliedContextId = undefined;
      }

      if (!this.previousStates.has(node.id)) {
        this.captureState(node.id, nodes);
        this.affectedNodeIds.push(node.id);
      }
      updatedNodes = updateNodeMetadata(updatedNodes, node.id, metadataUpdates);
    }

    return updatedNodes;
  }

  undo(): void {
    const nodes = this.getNodes();
    let updatedNodes = nodes;

    for (const nodeId of this.affectedNodeIds) {
      const previousState = this.previousStates.get(nodeId);
      if (previousState) {
        updatedNodes = updateNodeMetadata(updatedNodes, nodeId, {
          isBlueprint: previousState.isBlueprint,
          blueprintIcon: previousState.blueprintIcon,
          blueprintColor: previousState.blueprintColor,
          isContextDeclaration: previousState.isContextDeclaration,
          appliedContextId: previousState.appliedContextId,
        });
      }
    }

    this.setNodes(updatedNodes);
    this.triggerAutosave?.();

    if (this.removedContextDeclarationIds.length > 0) {
      this.refreshContextDeclarations?.();
    }
  }

  redo(): void {
    this.execute();
  }
}
