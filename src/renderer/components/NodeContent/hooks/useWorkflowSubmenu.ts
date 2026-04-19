import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { AncestorRegistry } from '../../../utils/ancestry';
import { getParentIdOrNull } from '../../../utils/nodeHelpers';
import {
  isChildOfWorkflowStep,
  findNextStepTarget,
  findPreviousStepTarget,
  getWorkflowStepPosition,
  isEligibleForExecution,
  WorkflowExecutionEntry,
} from '../../../utils/workflowHelpers';

interface BuildWorkflowSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  onRemoveFromWorkflow: () => void;
  onConfigureStep: () => void;
}

export function buildWorkflowSubmenu({
  node,
  nodes,
  ancestorRegistry,
  onRemoveFromWorkflow,
  onConfigureStep,
}: BuildWorkflowSubmenuParams): ContextMenuItem | null {
  const parentId = getParentIdOrNull(node.id, ancestorRegistry);
  const parent = parentId ? nodes[parentId] : null;
  const isWorkflow = node.metadata.isWorkflow === true;
  const isWorkflowStep = parent?.metadata.isWorkflow === true && !isWorkflow;

  const submenuItems: ContextMenuItem[] = [];

  if (isWorkflow) {
    submenuItems.push({
      label: 'Remove from Workflow',
      onClick: onRemoveFromWorkflow,
    });
  }

  if (isWorkflowStep) {
    submenuItems.push({
      label: 'Configure Step',
      onClick: onConfigureStep,
    });
  }


  if (submenuItems.length === 0) return null;

  return {
    label: 'Workflow',
    submenu: submenuItems,
  };
}

interface BuildWorkflowExecutionItemsParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>;
  onStartWorkflow: () => void;
  onStopWorkflow: () => void;
  onContinueWorkflow: () => void;
}

export function buildWorkflowExecutionItems({
  node,
  nodes,
  ancestorRegistry,
  workflowExecutionStates,
  onStartWorkflow,
  onStopWorkflow,
  onContinueWorkflow,
}: BuildWorkflowExecutionItemsParams): ContextMenuItem[] {
  if (!isChildOfWorkflowStep(node.id, nodes, ancestorRegistry)) return [];

  const entry = workflowExecutionStates[node.id];

  if (entry?.state === 'running') {
    return [{ label: 'Stop Workflow', onClick: onStopWorkflow }];
  }

  if (entry?.state === 'awaiting-validation') {
    return [{ label: 'Continue Workflow', onClick: onContinueWorkflow }];
  }

  if (isEligibleForExecution(node.id, nodes, ancestorRegistry, workflowExecutionStates)) {
    const position = getWorkflowStepPosition(node.id, nodes, ancestorRegistry);
    const stepNode = position ? nodes[position.currentStepId] : null;
    const stepType = stepNode?.metadata.stepType as string | undefined;
    if (stepType === 'autonomous') {
      return [{ label: 'Start Workflow', onClick: onStartWorkflow }];
    }
  }

  return [];
}

interface BuildWorkflowNavigationItemsParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  collaboratingNodeId?: string | null;
  workflowExecutionStates?: Record<string, WorkflowExecutionEntry>;
  onMoveToNextStep: () => void;
  onMoveToPreviousStep: () => void;
}

export function buildWorkflowNavigationItems({
  node,
  nodes,
  ancestorRegistry,
  collaboratingNodeId,
  workflowExecutionStates,
  onMoveToNextStep,
  onMoveToPreviousStep,
}: BuildWorkflowNavigationItemsParams): ContextMenuItem[] {
  if (!isChildOfWorkflowStep(node.id, nodes, ancestorRegistry)) return [];
  if (collaboratingNodeId === node.id) return [];
  if (workflowExecutionStates?.[node.id]) return [];

  const items: ContextMenuItem[] = [];

  if (findNextStepTarget(node.id, nodes, ancestorRegistry)) {
    items.push({ label: 'Next step', onClick: onMoveToNextStep });
  }

  if (findPreviousStepTarget(node.id, nodes, ancestorRegistry)) {
    items.push({ label: 'Previous step', onClick: onMoveToPreviousStep });
  }

  return items;
}
