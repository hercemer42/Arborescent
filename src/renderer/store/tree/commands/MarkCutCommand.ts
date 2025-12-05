import { TreeNode } from '../../../../shared/types';
import { BaseCommand } from './Command';

/**
 * Command for marking nodes as cut (non-destructive).
 * Sets metadata.transient.isCut = true on nodes.
 * Undoing this command clears the cut state.
 */
export class MarkCutCommand extends BaseCommand {
  description = 'Mark nodes as cut';

  constructor(
    private nodeIds: string[],
    private getState: () => {
      nodes: Record<string, TreeNode>;
    },
    private setState: (partial: { nodes?: Record<string, TreeNode> }) => void
  ) {
    super();
    this.description = `Cut ${nodeIds.length} node(s)`;
  }

  execute(): void {
    const { nodes } = this.getState();
    const updatedNodes = { ...nodes };

    for (const nodeId of this.nodeIds) {
      const node = updatedNodes[nodeId];
      if (node) {
        updatedNodes[nodeId] = {
          ...node,
          metadata: {
            ...node.metadata,
            transient: {
              ...node.metadata.transient,
              isCut: true,
            },
          },
        };
      }
    }

    this.setState({ nodes: updatedNodes });
  }

  undo(): void {
    const { nodes } = this.getState();
    const updatedNodes = { ...nodes };

    for (const nodeId of this.nodeIds) {
      const node = updatedNodes[nodeId];
      if (node) {
        const { transient, ...restMetadata } = node.metadata;
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { isCut, ...restTransient } = transient || {};

        // If transient is now empty, remove it entirely
        const newMetadata =
          Object.keys(restTransient).length > 0
            ? { ...restMetadata, transient: restTransient }
            : restMetadata;

        updatedNodes[nodeId] = {
          ...node,
          metadata: newMetadata,
        };
      }
    }

    this.setState({ nodes: updatedNodes });
  }

  getMarkedNodeIds(): string[] {
    return [...this.nodeIds];
  }
}
