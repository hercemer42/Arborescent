import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { updateNodeMetadata } from '../../../utils/nodeHelpers';
import { declareNodeMetadata } from '../../../utils/clearTaskMetadata';

export class DeclareWorkflowCommand extends BaseCommand {
  private previousMetadata: Map<string, Record<string, unknown>> = new Map();

  constructor(
    private nodeId: string,
    private getNodes: () => Record<string, TreeNode>,
    private setNodes: (nodes: Record<string, TreeNode>) => void,
    private triggerAutosave?: () => void
  ) {
    super();
    this.description = `Declare ${nodeId} as workflow`;
  }

  execute(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node) return;

    this.previousMetadata.clear();
    this.previousMetadata.set(this.nodeId, { ...node.metadata });

    let updatedNodes = declareNodeMetadata(nodes, this.nodeId, {
      isBlueprint: true,
      isWorkflow: true,
    });

    for (const childId of node.children) {
      const child = updatedNodes[childId];
      if (child && child.metadata.isBlueprint !== true) {
        this.previousMetadata.set(childId, { ...child.metadata });
        updatedNodes = updateNodeMetadata(updatedNodes, childId, {
          isBlueprint: true,
        });
      }
    }

    this.setNodes(updatedNodes);
    this.triggerAutosave?.();
  }

  undo(): void {
    const nodes = this.getNodes();
    let updatedNodes = { ...nodes };

    for (const [id, metadata] of this.previousMetadata) {
      const node = updatedNodes[id];
      if (!node) continue;
      updatedNodes = {
        ...updatedNodes,
        [id]: { ...node, metadata: { ...metadata } },
      };
    }

    this.setNodes(updatedNodes);
    this.triggerAutosave?.();
  }
}
