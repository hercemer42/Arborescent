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
    stopWorkflow: (nodeId: string) => void;
    continueWorkflow: (nodeId: string, terminalId: string | null) => void;
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
        label: 'Stop Workflow',
        onClick: () => actions.stopWorkflow(node.id),
      },
    ];
  }

  if (entry?.state === 'awaiting-validation') {
    return [
      {
        label: 'Continue Workflow',
        onClick: () => {
          getTerminalId().then((terminalId) => {
            actions.continueWorkflow(node.id, terminalId);
          });
        },
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
