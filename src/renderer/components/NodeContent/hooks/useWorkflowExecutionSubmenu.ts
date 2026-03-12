import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { AncestorRegistry } from '../../../utils/ancestry';
import {
  isEligibleForExecution,
  getWorkflowStepPosition,
  WorkflowExecutionEntry,
} from '../../../utils/workflowHelpers';
import { StepType } from '../../../store/tree/commands/SetStepTypeCommand';

interface BuildWorkflowExecutionSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>;
  actions: {
    startWorkflow: (nodeId: string, terminalId: string | null) => void;
    pauseWorkflow: (nodeId: string) => void;
    resumeWorkflow: (nodeId: string, terminalId: string | null) => void;
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
    const position = getWorkflowStepPosition(node.id, nodes, ancestorRegistry);
    const stepNode = position ? nodes[position.currentStepId] : null;
    const stepType: StepType = (stepNode?.metadata.stepType as StepType) || 'manual';

    if (stepType === 'manual' || stepType === 'checkpoint') {
      return [];
    }

    return [
      {
        label: 'Resume Workflow',
        onClick: () => {
          getTerminalId().then((terminalId) => {
            actions.resumeWorkflow(node.id, terminalId);
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
