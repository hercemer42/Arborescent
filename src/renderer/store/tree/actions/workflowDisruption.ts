import type { TreeNode } from '@shared/types';

type TreeState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
};

type DisruptionActions = {
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
    const ancestors = state.ancestorRegistry[id] || [];
    const parentId = ancestors[ancestors.length - 1] || state.rootNodeId;
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
  stepDeletions: StepDeletion[]
): void {
  const actions = (get() as TreeState & { actions?: DisruptionActions }).actions;
  if (!actions) return;

  for (const id of allDeletedIds) {
    actions.handleNodeDeleted?.(id);
  }

  for (const { stepId, workflowId } of stepDeletions) {
    actions.handleStepDeleted?.(stepId);

    const currentState = get();
    const workflow = currentState.nodes[workflowId];
    if (workflow && workflow.children.length === 0) {
      actions.handleAllStepsRemoved?.(workflowId);
    }
  }
}

export function notifyMovementDisruption(
  get: () => TreeState,
  nodeId: string
): void {
  const actions = (get() as TreeState & { actions?: { handleNodeMovedManually?: (id: string) => void } }).actions;
  actions?.handleNodeMovedManually?.(nodeId);
}
