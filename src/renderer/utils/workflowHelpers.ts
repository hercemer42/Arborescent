import { TreeNode } from '../../shared/types';
import { AncestorRegistry } from '../services/ancestry';

export function isWorkflowNode(nodeId: string, nodes: Record<string, TreeNode>): boolean {
  const node = nodes[nodeId];
  return node?.metadata.isWorkflow === true;
}

export function getWorkflowStepNumber(
  nodeId: string,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): number | null {
  const ancestors = ancestorRegistry[nodeId] || [];
  const parentId = ancestors[ancestors.length - 1];
  if (!parentId) return null;

  const parent = nodes[parentId];
  if (!parent || parent.metadata.isWorkflow !== true) return null;

  const index = parent.children.indexOf(nodeId);
  return index >= 0 ? index + 1 : null;
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
  const ancestors = ancestorRegistry[nodeId] || [];
  const parentId = ancestors[ancestors.length - 1];
  if (!parentId) return null;

  const parentAncestors = ancestorRegistry[parentId] || [];
  const grandparentId = parentAncestors[parentAncestors.length - 1];
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
