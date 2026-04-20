import { TreeNode } from '../../shared/types';
import { AncestorRegistry } from '../utils/ancestry';
import { getParentIdOrNull } from './nodeHelpers';

export function isWorkflowNode(nodeId: string, nodes: Record<string, TreeNode>): boolean {
  const node = nodes[nodeId];
  return node?.metadata.isWorkflow === true;
}

export function getWorkflowStepNumber(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): number | null {
  const node = nodes[nodeId];
  if (node?.metadata.isWorkflow === true) return null;

  const parentId = getParentIdOrNull(nodeId, ancestorRegistry);
  if (!parentId) return null;

  const parent = nodes[parentId];
  if (!parent || parent.metadata.isWorkflow !== true) return null;

  const rootWorkflowId = findRootWorkflow(nodeId, nodes, ancestorRegistry);
  if (!rootWorkflowId) return null;

  const result = countStepsDepthFirst(rootWorkflowId, nodeId, nodes);
  return result.found ? result.count : null;
}

function findRootWorkflow(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string | null {
  const ancestors = ancestorRegistry[nodeId] || [];
  let rootWorkflowId: string | null = null;
  for (const ancestorId of ancestors) {
    if (nodes[ancestorId]?.metadata.isWorkflow === true) {
      rootWorkflowId = ancestorId;
      break;
    }
  }
  return rootWorkflowId;
}

function countStepsDepthFirst(
  workflowId: string,
  targetId: string,
  nodes: Record<string, TreeNode>
): { count: number; found: boolean } {
  const workflow = nodes[workflowId];
  if (!workflow) return { count: 0, found: false };

  let count = 0;
  for (const childId of workflow.children) {
    const child = nodes[childId];
    if (!child) continue;

    if (child.metadata.isWorkflow === true) {
      const result = countStepsDepthFirst(childId, targetId, nodes);
      count += result.count;
      if (result.found) return { count, found: true };
      continue;
    }

    count++;
    if (childId === targetId) return { count, found: true };
  }
  return { count, found: false };
}

export function isChildOfWorkflowStep(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): boolean {
  return getWorkflowStepPosition(nodeId, nodes, ancestorRegistry) !== null;
}

export function getWorkflowStepPosition(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): { workflowNodeId: string; currentStepId: string; currentStepIndex: number; totalSteps: number } | null {
  const parentId = getParentIdOrNull(nodeId, ancestorRegistry);
  if (!parentId) return null;

  const parent = nodes[parentId];
  if (parent?.metadata.isWorkflow === true) return null;

  const grandparentId = getParentIdOrNull(parentId, ancestorRegistry);
  if (!grandparentId) return null;

  const grandparent = nodes[grandparentId];
  if (!grandparent || grandparent.metadata.isWorkflow !== true) return null;

  const currentStepIndex = grandparent.children.indexOf(parentId);
  if (currentStepIndex < 0) return null;

  return {
    workflowNodeId: grandparentId,
    currentStepId: parentId,
    currentStepIndex,
    totalSteps: grandparent.children.length,
  };
}

export function hasAncestorWorkflow(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): boolean {
  const ancestors = ancestorRegistry[nodeId] || [];
  return ancestors.some(id => nodes[id]?.metadata.isWorkflow === true);
}

export function hasDescendantWorkflow(
  nodeId: string,
  nodes: Record<string, TreeNode>
): boolean {
  const node = nodes[nodeId];
  if (!node) return false;

  for (const childId of node.children) {
    const child = nodes[childId];
    if (child?.metadata.isWorkflow === true) return true;
    if (hasDescendantWorkflow(childId, nodes)) return true;
  }
  return false;
}

export function findNextStepTarget(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string | null {
  const position = getWorkflowStepPosition(nodeId, nodes, ancestorRegistry);
  if (!position) return null;

  return findNextStepFrom(position.workflowNodeId, position.currentStepIndex, nodes, ancestorRegistry);
}

function findNextStepFrom(
  workflowId: string,
  currentStepIndex: number,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string | null {
  const workflow = nodes[workflowId];
  if (!workflow) return null;

  for (let i = currentStepIndex + 1; i < workflow.children.length; i++) {
    const siblingId = workflow.children[i];
    const sibling = nodes[siblingId];
    if (!sibling) continue;

    if (sibling.metadata.isWorkflow === true) {
      const firstStep = drillIntoFirstStep(siblingId, nodes);
      if (firstStep) return firstStep;
      continue;
    }
    return siblingId;
  }

  const parentId = getParentIdOrNull(workflowId, ancestorRegistry);
  if (!parentId) return null;

  const parent = nodes[parentId];
  if (!parent || parent.metadata.isWorkflow !== true) return null;

  const workflowIndex = parent.children.indexOf(workflowId);
  if (workflowIndex < 0) return null;

  return findNextStepFrom(parentId, workflowIndex, nodes, ancestorRegistry);
}

function drillIntoFirstStep(
  workflowId: string,
  nodes: Record<string, TreeNode>
): string | null {
  const workflow = nodes[workflowId];
  if (!workflow) return null;

  for (const childId of workflow.children) {
    const child = nodes[childId];
    if (!child) continue;

    if (child.metadata.isWorkflow === true) {
      const deeper = drillIntoFirstStep(childId, nodes);
      if (deeper) return deeper;
      continue;
    }
    return childId;
  }
  return null;
}

export function findPreviousStepTarget(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string | null {
  const position = getWorkflowStepPosition(nodeId, nodes, ancestorRegistry);
  if (!position) return null;

  return findPreviousStepFrom(position.workflowNodeId, position.currentStepIndex, nodes, ancestorRegistry);
}

function findPreviousStepFrom(
  workflowId: string,
  currentStepIndex: number,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string | null {
  const workflow = nodes[workflowId];
  if (!workflow) return null;

  for (let i = currentStepIndex - 1; i >= 0; i--) {
    const siblingId = workflow.children[i];
    const sibling = nodes[siblingId];
    if (!sibling) continue;

    if (sibling.metadata.isWorkflow === true) {
      const lastStep = drillIntoLastStep(siblingId, nodes);
      if (lastStep) return lastStep;
      continue;
    }
    return siblingId;
  }

  const parentId = getParentIdOrNull(workflowId, ancestorRegistry);
  if (!parentId) return null;

  const parent = nodes[parentId];
  if (!parent || parent.metadata.isWorkflow !== true) return null;

  const workflowIndex = parent.children.indexOf(workflowId);
  if (workflowIndex < 0) return null;

  return findPreviousStepFrom(parentId, workflowIndex, nodes, ancestorRegistry);
}

function drillIntoLastStep(
  workflowId: string,
  nodes: Record<string, TreeNode>
): string | null {
  const workflow = nodes[workflowId];
  if (!workflow) return null;

  for (let i = workflow.children.length - 1; i >= 0; i--) {
    const childId = workflow.children[i];
    const child = nodes[childId];
    if (!child) continue;

    if (child.metadata.isWorkflow === true) {
      const deeper = drillIntoLastStep(childId, nodes);
      if (deeper) return deeper;
      continue;
    }
    return childId;
  }
  return null;
}

export function collectDescendantWorkflows(
  nodeId: string,
  nodes: Record<string, TreeNode>
): string[] {
  const result: string[] = [];
  const node = nodes[nodeId];
  if (!node) return result;

  for (const childId of node.children) {
    const child = nodes[childId];
    if (child?.metadata.isWorkflow === true) {
      result.push(childId);
    }
    result.push(...collectDescendantWorkflows(childId, nodes));
  }
  return result;
}

export function isDecompositionEnabled(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): boolean {
  const position = getWorkflowStepPosition(nodeId, nodes, ancestorRegistry);
  if (!position) return false;
  return nodes[position.currentStepId]?.metadata.decomposition === true;
}

export function findFirstAutonomousStepInChain(
  stepId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): string | null {
  const workflowId = getParentIdOrNull(stepId, ancestorRegistry);
  if (!workflowId) return null;

  const workflow = nodes[workflowId];
  if (!workflow || workflow.metadata.isWorkflow !== true) return null;

  const stepIndex = workflow.children.indexOf(stepId);
  if (stepIndex < 0) return null;

  let firstAutonomous = stepId;
  for (let i = stepIndex - 1; i >= 0; i--) {
    const siblingId = workflow.children[i];
    const sibling = nodes[siblingId];
    if (!sibling || (sibling.metadata.stepType as string) !== 'autonomous') break;
    firstAutonomous = siblingId;
  }

  const step = nodes[firstAutonomous];
  if (!step || (step.metadata.stepType as string) !== 'autonomous') return null;

  return firstAutonomous;
}

export function findNextWaitingNode(
  stepId: string,
  nodes: Record<string, TreeNode>,
  executionStates: Record<string, { state: string }>
): string | null {
  const step = nodes[stepId];
  if (!step) return null;

  for (const childId of step.children) {
    if (!executionStates[childId]) return childId;
  }

  return null;
}

export function getArchiveConfigForNode(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): { archiveDestinationId: string; archiveSideLinkName: string; replacementSideLinkName: string } | undefined {
  const position = getWorkflowStepPosition(nodeId, nodes, ancestorRegistry);
  if (!position) return undefined;

  const stepNode = nodes[position.currentStepId];
  if (!stepNode) return undefined;

  const destId = stepNode.metadata.archiveDestinationId as string | undefined;
  if (!destId) return undefined;

  return {
    archiveDestinationId: destId,
    archiveSideLinkName: (stepNode.metadata.archiveSideLinkName as string) || 'Output',
    replacementSideLinkName: (stepNode.metadata.replacementSideLinkName as string) || 'Source',
  };
}

export type WorkflowExecutionEntry = { state: 'running' | 'awaiting-validation'; terminalTabId: string; needsReview?: boolean; collaborating?: boolean; stopReceived?: boolean; clearing?: boolean };

export function isEligibleForExecution(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry,
  executionStates: Record<string, WorkflowExecutionEntry>
): boolean {
  const node = nodes[nodeId];
  if (!node) return false;

  const ancestors = ancestorRegistry[nodeId];
  if (!ancestors) return false;

  if (node.metadata.isWorkflow === true) return false;
  if (node.metadata.isContextDeclaration === true) return false;

  const entry = executionStates[nodeId];
  if (entry) return false;

  if (getWorkflowStepPosition(nodeId, nodes, ancestorRegistry) !== null) return true;

  return false;
}
