import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { updateNodeMetadata, getAllDescendants } from '../../../utils/nodeHelpers';

export class RemoveContextCommand extends BaseCommand {
  private previousMetadata: Map<string, Record<string, unknown>> = new Map();
  private affectedNodeIds: string[] = [];

  constructor(
    private nodeId: string,
    private getNodes: () => Record<string, TreeNode>,
    private getAncestorRegistry: () => Record<string, string[]>,
    private setNodes: (nodes: Record<string, TreeNode>) => void,
    private triggerAutosave?: () => void,
    private refreshContextDeclarations?: () => void
  ) {
    super();
    this.description = `Remove context declaration from ${nodeId}`;
  }

  execute(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    this.previousMetadata.clear();
    this.affectedNodeIds = [];

    const ancestorRegistry = this.getAncestorRegistry();
    const ancestors = ancestorRegistry[this.nodeId] || [];
    const hasAncestorContext = ancestors.some(
      ancestorId => nodes[ancestorId]?.metadata.isContextDeclaration === true
    );

    this.captureState(this.nodeId, nodes);
    this.affectedNodeIds.push(this.nodeId);

    let updatedNodes: Record<string, TreeNode>;
    if (hasAncestorContext) {
      updatedNodes = updateNodeMetadata(nodes, this.nodeId, {
        isContextDeclaration: false,
        blueprintIcon: undefined,
        blueprintColor: undefined,
        contextMode: undefined,
      });
    } else {
      updatedNodes = updateNodeMetadata(nodes, this.nodeId, {
        isContextDeclaration: false,
        blueprintIcon: undefined,
        blueprintColor: undefined,
        contextMode: undefined,
        isBlueprint: false,
      });

      const descendantIds = getAllDescendants(this.nodeId, nodes);
      for (const descendantId of descendantIds) {
        const descendant = updatedNodes[descendantId];
        if (!descendant) continue;
        if (descendant.metadata.isContextDeclaration === true) continue;

        this.captureState(descendantId, nodes);
        this.affectedNodeIds.push(descendantId);
        updatedNodes = updateNodeMetadata(updatedNodes, descendantId, {
          isBlueprint: false,
        });
      }
    }

    updatedNodes = this.removeAppliedContextFromAllNodes(this.nodeId, updatedNodes, nodes);

    this.setNodes(updatedNodes);
    this.triggerAutosave?.();
    this.refreshContextDeclarations?.();
  }

  undo(): void {
    const nodes = this.getNodes();
    let updatedNodes = { ...nodes };

    for (const nodeId of this.affectedNodeIds) {
      const previousState = this.previousMetadata.get(nodeId);
      if (previousState) {
        updatedNodes = {
          ...updatedNodes,
          [nodeId]: { ...updatedNodes[nodeId], metadata: { ...previousState } },
        };
      }
    }

    this.setNodes(updatedNodes);
    this.triggerAutosave?.();
    this.refreshContextDeclarations?.();
  }

  private captureState(nodeId: string, nodes: Record<string, TreeNode>): void {
    const node = nodes[nodeId];
    if (node && !this.previousMetadata.has(nodeId)) {
      this.previousMetadata.set(nodeId, { ...node.metadata });
    }
  }

  private removeAppliedContextFromAllNodes(
    contextNodeId: string,
    updatedNodes: Record<string, TreeNode>,
    originalNodes: Record<string, TreeNode>
  ): Record<string, TreeNode> {
    for (const node of Object.values(originalNodes)) {
      const ids = (node.metadata.appliedContextIds as string[]) || [];
      const appliedContextId = node.metadata.appliedContextId as string | undefined;
      const hasOldPlural = ids.includes(contextNodeId);
      const hasSingular = appliedContextId === contextNodeId;

      if (!hasOldPlural && !hasSingular) continue;

      if (!this.previousMetadata.has(node.id)) {
        this.captureState(node.id, originalNodes);
        this.affectedNodeIds.push(node.id);
      }

      const metadataUpdates: Record<string, unknown> = {};

      if (hasOldPlural) {
        const newIds = ids.filter(id => id !== contextNodeId);
        metadataUpdates.appliedContextIds = newIds.length > 0 ? newIds : undefined;
        const currentActiveContextId = node.metadata.activeContextId as string | undefined;
        if (newIds.length === 0) {
          metadataUpdates.activeContextId = undefined;
        } else if (currentActiveContextId === contextNodeId) {
          metadataUpdates.activeContextId = newIds[0];
        }
      }

      if (hasSingular) {
        metadataUpdates.appliedContextId = undefined;
      }

      updatedNodes = updateNodeMetadata(updatedNodes, node.id, metadataUpdates);
    }

    return updatedNodes;
  }
}
