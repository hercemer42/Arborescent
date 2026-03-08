import { BaseCommand } from './Command';
import { TreeNode } from '../../../../shared/types';
import { updateNodeMetadata } from '../../../utils/nodeHelpers';
import { collectDescendantWorkflows } from '../../../utils/workflowHelpers';

export class RemoveWorkflowCommand extends BaseCommand {
  private previousMetadata: Map<string, Record<string, unknown>> = new Map();

  constructor(
    private nodeId: string,
    private getNodes: () => Record<string, TreeNode>,
    private setNodes: (nodes: Record<string, TreeNode>) => void,
    private triggerAutosave?: () => void
  ) {
    super();
    this.description = `Remove ${nodeId} from workflow`;
  }

  execute(): void {
    const nodes = this.getNodes();
    const node = nodes[this.nodeId];
    if (!node || node.metadata.isWorkflow !== true) return;

    this.previousMetadata.clear();

    const descendantWorkflows = collectDescendantWorkflows(this.nodeId, nodes);
    const allAffected = [this.nodeId, ...descendantWorkflows];

    for (const id of allAffected) {
      const n = nodes[id];
      if (n) {
        this.previousMetadata.set(id, { ...n.metadata });
      }
    }

    let updatedNodes = nodes;
    for (const id of allAffected) {
      updatedNodes = updateNodeMetadata(updatedNodes, id, {
        isWorkflow: undefined,
      });
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
