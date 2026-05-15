import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { AncestorRegistry } from '../../../utils/ancestry';

interface BuildSendToWorkflowSubmenuParams {
  sourceNodeId: string;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  onSendToWorkflow: (destWorkflowId: string) => void;
}

const MAX_LABEL_LENGTH = 40;

function workflowLabel(content: string): string {
  const trimmed = content.trim() || '(untitled)';
  return trimmed.length > MAX_LABEL_LENGTH
    ? trimmed.slice(0, MAX_LABEL_LENGTH) + '...'
    : trimmed;
}

function isDescendantOfSource(
  workflowId: string,
  sourceNodeId: string,
  ancestorRegistry: AncestorRegistry,
): boolean {
  return (ancestorRegistry[workflowId] || []).includes(sourceNodeId);
}

export function buildSendToWorkflowSubmenu({
  sourceNodeId,
  nodes,
  ancestorRegistry,
  onSendToWorkflow,
}: BuildSendToWorkflowSubmenuParams): ContextMenuItem[] | null {
  const workflowNodes = Object.values(nodes)
    .filter((candidate) => candidate.metadata.isWorkflow === true)
    .filter((candidate) => candidate.id !== sourceNodeId)
    .filter((candidate) => !isDescendantOfSource(candidate.id, sourceNodeId, ancestorRegistry))
    .sort((a, b) => a.content.localeCompare(b.content));

  if (workflowNodes.length === 0) return null;

  return workflowNodes.map((workflow) => ({
    label: workflowLabel(workflow.content),
    onClick: () => onSendToWorkflow(workflow.id),
  }));
}
