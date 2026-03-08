import { TreeNode } from '../../../../shared/types';
import { useStore } from '../../../store/tree/useStore';
import { getWorkflowStepNumber } from '../../../utils/workflowHelpers';

interface WorkflowIndicator {
  isWorkflow: boolean;
  stepNumber: number | null;
}

export function useWorkflowIndicator(node: TreeNode): WorkflowIndicator {
  const isWorkflow = node.metadata.isWorkflow === true;

  const stepNumber = useStore((state) => {
    if (isWorkflow) return null;
    return getWorkflowStepNumber(node.id, state.nodes, state.ancestorRegistry);
  });

  return { isWorkflow, stepNumber };
}
