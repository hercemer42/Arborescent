import type { TreeNode } from '@shared/types';
import { getParentId } from '../../../utils/nodeHelpers';

type TreeState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
};

export type DisruptionActions = {
  handleNodeDeleted?: (nodeId: string) => void;
  handleStepDeleted?: (stepId: string) => void;
  handleAllStepsRemoved?: (workflowId: string) => void;
};

export type StepDeletion = { stepId: string; workflowId: string };

export function captureStepDeletions(
  nodeIds: string[],
  state: TreeState
): StepDeletion[] {
  const deletions: StepDeletion[] = [];
  for (const id of nodeIds) {
    const parentId = getParentId(id, state.ancestorRegistry, state.rootNodeId);
    const parent = state.nodes[parentId];
    if (parent?.metadata.isWorkflow === true) {
      deletions.push({ stepId: id, workflowId: parentId });
    }
  }
  return deletions;
}

export function notifyDeletionDisruption(
  get: () => TreeState,
  allDeletedIds: string[],
  stepDeletions: StepDeletion[],
  disruption: DisruptionActions | undefined
): void {
  if (!disruption) return;

  for (const id of allDeletedIds) {
    disruption.handleNodeDeleted?.(id);
  }

  for (const { stepId, workflowId } of stepDeletions) {
    disruption.handleStepDeleted?.(stepId);

    const currentState = get();
    const workflow = currentState.nodes[workflowId];
    if (workflow && workflow.children.length === 0) {
      disruption.handleAllStepsRemoved?.(workflowId);
    }
  }
}
