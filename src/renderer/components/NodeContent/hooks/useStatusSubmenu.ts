import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';

interface BuildStatusSubmenuParams {
  node: TreeNode;
  onMarkAllAsComplete: () => void;
  onMarkAllAsIncomplete: () => void;
}

export function buildStatusSubmenu({
  node,
  onMarkAllAsComplete,
  onMarkAllAsIncomplete,
}: BuildStatusSubmenuParams): ContextMenuItem | null {
  if (node.metadata.isBlueprint === true) {
    return null;
  }

  if (node.metadata.isHyperlink === true || node.metadata.isExternalLink === true) {
    return null;
  }

  if (node.children.length === 0) {
    return null;
  }

  return {
    label: 'Status',
    submenu: [
      {
        label: 'Mark all as complete',
        onClick: onMarkAllAsComplete,
      },
      {
        label: 'Mark all as incomplete',
        onClick: onMarkAllAsIncomplete,
      },
    ],
  };
}
