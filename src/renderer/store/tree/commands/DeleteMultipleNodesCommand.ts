import { TreeNode } from '../../../../shared/types';
import { MultiNodeDeletionCommand } from './MultiNodeDeletionCommand';
import { StepHistoryEntry, StepHistoryMap } from '../stepHistory/stepHistory';

type DeleteStateGetter = () => {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  stepHistory?: StepHistoryMap;
};

type DeleteStateSetter = (partial: {
  nodes?: Record<string, TreeNode>;
  ancestorRegistry?: Record<string, string[]>;
  activeNodeId?: string;
  cursorPosition?: number;
  multiSelectedNodeIds?: Set<string>;
  stepHistory?: StepHistoryMap;
}) => void;

export class DeleteMultipleNodesCommand extends MultiNodeDeletionCommand {
  private preservedStepHistory: Record<string, StepHistoryEntry[]> = {};

  constructor(
    nodeIds: string[],
    private getDeleteState: DeleteStateGetter,
    private setDeleteState: DeleteStateSetter,
    findPreviousNode: (
      nodeId: string,
      nodes: Record<string, TreeNode>,
      rootNodeId: string,
      ancestorRegistry: Record<string, string[]>
    ) => string | null,
    triggerAutosave?: () => void
  ) {
    super(nodeIds, getDeleteState, setDeleteState, findPreviousNode, triggerAutosave);
  }

  execute(): void {
    this.capturePreservedStepHistory();
    super.execute();
    this.clearDeletedStepHistory();
  }

  undo(): void {
    super.undo();
    this.restorePreservedStepHistory();
  }

  private collectSubtreeIds(): string[] {
    const { nodes } = this.getDeleteState();
    const collected: string[] = [];
    const visit = (id: string): void => {
      const node = nodes[id];
      if (!node) return;
      collected.push(id);
      node.children.forEach(visit);
    };
    this.getDeletedNodeIds().forEach(visit);
    return collected;
  }

  private capturePreservedStepHistory(): void {
    const { stepHistory } = this.getDeleteState();
    if (!stepHistory) return;

    this.preservedStepHistory = {};
    for (const id of this.collectSubtreeIds()) {
      if (stepHistory[id]) {
        this.preservedStepHistory[id] = stepHistory[id];
      }
    }
  }

  private clearDeletedStepHistory(): void {
    const { stepHistory } = this.getDeleteState();
    const preservedIds = Object.keys(this.preservedStepHistory);
    if (!stepHistory || preservedIds.length === 0) return;

    const updatedStepHistory = { ...stepHistory };
    for (const id of preservedIds) {
      delete updatedStepHistory[id];
    }
    this.setDeleteState({ stepHistory: updatedStepHistory });
  }

  private restorePreservedStepHistory(): void {
    const { stepHistory } = this.getDeleteState();
    const preservedIds = Object.keys(this.preservedStepHistory);
    if (!stepHistory || preservedIds.length === 0) return;

    this.setDeleteState({ stepHistory: { ...stepHistory, ...this.preservedStepHistory } });
  }
}
