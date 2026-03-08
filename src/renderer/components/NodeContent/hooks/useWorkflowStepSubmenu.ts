import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { AncestorRegistry } from '../../../utils/ancestry';
import {
  isChildOfWorkflowStep,
  findNextStepTarget,
  findPreviousStepTarget,
} from '../../../utils/workflowHelpers';

interface BuildWorkflowStepSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  actions: {
    moveToNextStep: (id: string) => void;
    moveToPreviousStep: (id: string) => void;
  };
}

export function buildWorkflowStepSubmenu({
  node,
  nodes,
  ancestorRegistry,
  actions,
}: BuildWorkflowStepSubmenuParams): ContextMenuItem[] {
  if (!isChildOfWorkflowStep(node.id, nodes, ancestorRegistry)) return [];

  const items: ContextMenuItem[] = [];

  if (findNextStepTarget(node.id, nodes, ancestorRegistry)) {
    items.push({
      label: 'Next step',
      onClick: () => actions.moveToNextStep(node.id),
    });
  }

  if (findPreviousStepTarget(node.id, nodes, ancestorRegistry)) {
    items.push({
      label: 'Previous step',
      onClick: () => actions.moveToPreviousStep(node.id),
    });
  }

  return items;
}
