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
import type { StepHistoryEntry, StepHistoryMap } from '../../../store/tree/stepHistory/stepHistory';

interface BuildWorkflowSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  onRemoveFromWorkflow: () => void;
  onConfigureStep: () => void;
  stepHistory?: StepHistoryMap;
  onRestoreStepHistory?: (stepId: string, entryId: string) => void;
}

function formatCapturedAt(capturedAt: string): string {
  const date = new Date(capturedAt);
  if (Number.isNaN(date.getTime())) return capturedAt;
  return date.toLocaleString();
}

function buildStepHistoryItem(
  stepId: string,
  entries: StepHistoryEntry[] | undefined,
  onRestoreStepHistory: ((stepId: string, entryId: string) => void) | undefined,
): ContextMenuItem {
  if (!entries || entries.length === 0) {
    return {
      label: 'Step History',
      disabled: true,
      disabledTooltip: 'No history yet',
    };
  }
  return {
    label: 'Step History',
    submenu: entries.map((entry) => ({
      label: entry.parentLabel,
      tooltip: formatCapturedAt(entry.capturedAt),
      onClick: () => onRestoreStepHistory?.(stepId, entry.id),
    })),
  };
}

export function buildWorkflowSubmenu({
  node,
  nodes,
  ancestorRegistry,
  onRemoveFromWorkflow,
  onConfigureStep,
  stepHistory,
  onRestoreStepHistory,
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
    submenuItems.push(buildStepHistoryItem(node.id, stepHistory?.[node.id], onRestoreStepHistory));
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
  onResendStep: () => void;
}

export function buildWorkflowExecutionItems({
  node,
  nodes,
  ancestorRegistry,
  workflowExecutionStates,
  onStartWorkflow,
  onStopWorkflow,
  onResendStep,
}: BuildWorkflowExecutionItemsParams): ContextMenuItem[] {
  if (!isChildOfWorkflowStep(node.id, nodes, ancestorRegistry)) return [];

  const entry = workflowExecutionStates[node.id];

  if (entry?.state === 'running') {
    return [{ label: 'Stop Workflow', onClick: onStopWorkflow }];
  }

  if (entry?.state === 'awaiting-validation') {
    return [
      { label: 'Resend step', onClick: onResendStep },
      { label: 'Stop Workflow', onClick: onStopWorkflow },
    ];
  }

  if (isEligibleForExecution(node.id, nodes, ancestorRegistry, workflowExecutionStates)) {
    const position = getWorkflowStepPosition(node.id, nodes, ancestorRegistry);
    const stepNode = position ? nodes[position.currentStepId] : null;
    const stepType = stepNode?.metadata.stepType as string | undefined;
    if (stepType === 'autonomous' || stepType === 'checkpoint') {
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
  const navState = workflowExecutionStates?.[node.id]?.state;
  if (navState === 'running') return [];

  const items: ContextMenuItem[] = [];

  if (findNextStepTarget(node.id, nodes, ancestorRegistry)) {
    items.push({ label: 'Next step', onClick: onMoveToNextStep });
  }

  if (findPreviousStepTarget(node.id, nodes, ancestorRegistry)) {
    items.push({ label: 'Previous step', onClick: onMoveToPreviousStep });
  }

  return items;
}

export function combineExecutionAndNavigationItems(
  executionItems: ContextMenuItem[],
  navigationItems: ContextMenuItem[],
  resumeSessionItem: ContextMenuItem | null = null,
): ContextMenuItem[] {
  const resendIdx = executionItems.findIndex(item => item.label === 'Resend step');
  const nextStepIdx = navigationItems.findIndex(item => item.label === 'Next step');
  const resume = resumeSessionItem ? [resumeSessionItem] : [];

  if (resendIdx < 0 || nextStepIdx < 0) {
    return [...executionItems, ...resume, ...navigationItems];
  }

  return [
    ...executionItems.slice(0, resendIdx + 1),
    navigationItems[nextStepIdx],
    ...executionItems.slice(resendIdx + 1),
    ...resume,
    ...navigationItems.filter((_, i) => i !== nextStepIdx),
  ];
}
