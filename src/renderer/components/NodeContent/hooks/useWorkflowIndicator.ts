import { TreeNode } from '../../../../shared/types';
import { useStore } from '../../../store/tree/useStore';
import { getWorkflowStepNumber, hasAncestorWorkflow } from '../../../utils/workflowHelpers';
import { StepType } from '../../../store/tree/commands/SetStepTypeCommand';

interface WorkflowIndicator {
  isWorkflow: boolean;
  isInsideWorkflow: boolean;
  stepNumber: number | null;
  stepType: StepType;
}

const STEP_TYPE_LABELS: Record<StepType, string> = {
  manual: 'Manual',
  checkpoint: 'Checkpoint',
  autonomous: 'Autonomous',
};

export function getStepTypeLabel(stepType: StepType): string {
  return STEP_TYPE_LABELS[stepType];
}

export function useWorkflowIndicator(node: TreeNode): WorkflowIndicator {
  const isWorkflow = node.metadata.isWorkflow === true;
  const stepType = (node.metadata.stepType as StepType) || 'manual';

  const isInsideWorkflow = useStore((state) =>
    hasAncestorWorkflow(node.id, state.nodes, state.ancestorRegistry),
  );

  const stepNumber = useStore((state) => {
    if (isWorkflow) return null;
    return getWorkflowStepNumber(node.id, state.nodes, state.ancestorRegistry);
  });

  return { isWorkflow, isInsideWorkflow, stepNumber, stepType };
}
