import { TreeNode } from '../../../../shared/types';
import { useStore } from '../../../store/tree/useStore';

interface WorkflowIndicator {
  isWorkflow: boolean;
  stepNumber: number | null;
}

export function useWorkflowIndicator(node: TreeNode): WorkflowIndicator {
  const isWorkflow = node.metadata.isWorkflow === true;

  const stepNumber = useStore((state) => {
    const ancestors = state.ancestorRegistry[node.id] || [];
    const parentId = ancestors[ancestors.length - 1];
    if (!parentId) return null;

    const parent = state.nodes[parentId];
    if (!parent || parent.metadata.isWorkflow !== true) return null;

    const index = parent.children.indexOf(node.id);
    return index >= 0 ? index + 1 : null;
  });

  return { isWorkflow, stepNumber };
}
