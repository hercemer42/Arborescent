import { TreeNode } from '../../../../shared/types';
import { MultiNodeDeletionCommand } from './MultiNodeDeletionCommand';

/**
 * Command for cutting multiple nodes at once (single undo operation).
 * Identical to delete but with different description for undo history.
 */
export class CutMultipleNodesCommand extends MultiNodeDeletionCommand {
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
    this.description = `Cut ${nodeIds.length} node(s)`;
  }

  /**
   * Alias for getDeletedNodeIds for semantic clarity
   */
  getCutNodeIds(): string[] {
    return this.getDeletedNodeIds();
  }
}
