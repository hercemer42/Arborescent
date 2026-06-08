import { useCallback } from 'react';
import { TreeNode } from '../../../../shared/types';
import { useStore } from '../../../store/tree/useStore';
import { useActiveTreeStore } from '../../../store/tree/TreeStoreContext';

export interface WorkflowExecutionOverlay {
  executionState: 'running' | 'awaiting-validation' | null;
  stopWorkflow: () => void;
  unpauseWorkflow: () => void;
}

export function useWorkflowExecutionOverlay(node: TreeNode): WorkflowExecutionOverlay {
  const entry = useStore((state) => state.workflowExecutionStates[node.id]);
  const store = useActiveTreeStore();

  const executionState = entry?.state || null;

  const stopWorkflow = useCallback(() => {
    store.getState().actions.stopWorkflow(node.id);
  }, [store, node.id]);

  const unpauseWorkflow = useCallback(() => {
    store.getState().actions.unpauseWorkflow(node.id);
  }, [store, node.id]);

  return { executionState, stopWorkflow, unpauseWorkflow };
}
