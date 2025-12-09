import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';

interface BuildStatusSubmenuParams {
  node: TreeNode;
  onMarkAllAsComplete: () => void;
  onMarkAllAsIncomplete: () => void;
}

/**
 * Build the Status submenu for the context menu.
 * Returns null if the submenu should not be shown (blueprint nodes, hyperlinks, or nodes without children).
 */
export function buildStatusSubmenu({
  node,
  onMarkAllAsComplete,
  onMarkAllAsIncomplete,
}: BuildStatusSubmenuParams): ContextMenuItem | null {
  // Don't show for blueprint nodes
  if (node.metadata.isBlueprint === true) {
    return null;
  }

  // Don't show for hyperlinks or external links
  if (node.metadata.isHyperlink === true || node.metadata.isExternalLink === true) {
    return null;
  }

  // Don't show for nodes without children
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
