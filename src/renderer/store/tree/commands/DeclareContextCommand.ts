import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { updateNodeMetadata, getAllDescendants, ContextFlags } from '../../../utils/nodeHelpers';
import { declareNodeMetadata } from '../../../utils/clearTaskMetadata';

export class DeclareContextCommand extends BaseCommand {
  private previousMetadata: Map<string, Record<string, unknown>> = new Map();
  private affectedNodeIds: string[] = [];

  constructor(
    private nodeId: string,
    private icon: string,
    private color: string | undefined,
    private flags: ContextFlags,
    private getNodes: () => Record<string, TreeNode>,
    private setNodes: (nodes: Record<string, TreeNode>) => void,
    private triggerAutosave?: () => void,
    private refreshContextDeclarations?: () => void
  ) {
    super();
    this.description = `Declare ${nodeId} as context (collaborate=${flags.collaborate}, execute=${flags.execute})`;
  }

  execute(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    this.previousMetadata.clear();
    this.affectedNodeIds = [];

    this.captureState(this.nodeId, nodes);
    this.affectedNodeIds.push(this.nodeId);

    let updatedNodes = declareNodeMetadata(nodes, this.nodeId, {
      isContextDeclaration: true,
      blueprintIcon: this.icon,
      blueprintColor: this.color,
      isBlueprint: true,
      collaborate: this.flags.collaborate,
      execute: this.flags.execute,
    });

    const descendantIds = getAllDescendants(this.nodeId, nodes);
    const nestedContextIds = new Set<string>();

    for (const descendantId of descendantIds) {
      const descendant = updatedNodes[descendantId];
      if (descendant?.metadata.isContextDeclaration === true) {
        nestedContextIds.add(descendantId);
        const nestedDescendants = getAllDescendants(descendantId, nodes);
        for (const nestedId of nestedDescendants) {
          nestedContextIds.add(nestedId);
        }
      }
    }

    for (const descendantId of descendantIds) {
      if (nestedContextIds.has(descendantId)) continue;
      const descendant = updatedNodes[descendantId];
      if (descendant && descendant.metadata.isBlueprint !== true) {
        this.captureState(descendantId, nodes);
        this.affectedNodeIds.push(descendantId);
        updatedNodes = updateNodeMetadata(updatedNodes, descendantId, {
          isBlueprint: true,
        });
      }
    }

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
}
