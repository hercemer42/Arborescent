import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { AncestorRegistry } from '../../../utils/ancestry';
import {
  isEligibleForExecution,
  WorkflowExecutionEntry,
} from '../../../utils/workflowHelpers';

interface BuildWorkflowExecutionSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>;
  actions: {
    startWorkflow: (nodeId: string, terminalId: string | null) => void;
    pauseWorkflow: (nodeId: string) => void;
    resumeWorkflow: (nodeId: string) => void;
  };
  getTerminalId: () => Promise<string | null>;
}

export function buildWorkflowExecutionSubmenu({
  node,
  nodes,
  ancestorRegistry,
  workflowExecutionStates,
  actions,
  getTerminalId,
}: BuildWorkflowExecutionSubmenuParams): ContextMenuItem[] {
  const entry = workflowExecutionStates[node.id];

  if (entry?.state === 'running') {
    return [
      {
        label: 'Pause Workflow',
        onClick: () => actions.pauseWorkflow(node.id),
      },
    ];
  }

  if (entry?.state === 'paused') {
    return [
      {
        label: 'Resume Workflow',
        onClick: () => actions.resumeWorkflow(node.id),
      },
    ];
  }

  if (!entry && isEligibleForExecution(node.id, nodes, ancestorRegistry, workflowExecutionStates)) {
    return [
      {
        label: 'Start Workflow',
        onClick: () => {
          getTerminalId().then((terminalId) => {
            actions.startWorkflow(node.id, terminalId);
          });
        },
      },
    ];
  }

  return [];
}
