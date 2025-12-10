import { TreeNode } from '../../../../shared/types';
import { MultiNodeDeletionCommand } from './MultiNodeDeletionCommand';

export class DeleteMultipleNodesCommand extends MultiNodeDeletionCommand {
  constructor(
    nodeIds: string[],
    getState: () => {
      nodes: Record<string, TreeNode>;
      rootNodeId: string;
      ancestorRegistry: Record<string, string[]>;
    },
    setState: (partial: {
      nodes?: Record<string, TreeNode>;
      ancestorRegistry?: Record<string, string[]>;
      activeNodeId?: string;
      cursorPosition?: number;
      multiSelectedNodeIds?: Set<string>;
    }) => void,
    findPreviousNode: (
      nodeId: string,
      nodes: Record<string, TreeNode>,
      rootNodeId: string,
      ancestorRegistry: Record<string, string[]>
    ) => string | null,
    triggerAutosave?: () => void
  ) {
    super(nodeIds, getState, setState, findPreviousNode, triggerAutosave);
  }
}
