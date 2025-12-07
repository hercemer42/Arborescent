import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { AncestorRegistry } from '../../../services/ancestry';

interface BuildContextSubmenuParams {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  openIconPicker: (nodeId: string | null, callback: (selection: { icon: string; color?: string }) => void) => void;
  actions: {
    declareAsContext: (nodeId: string, icon?: string, color?: string) => void;
    removeContextDeclaration: (nodeId: string) => void;
  };
}

export function buildContextSubmenu({
  node,
  nodes,
  ancestorRegistry,
  openIconPicker,
  actions,
}: BuildContextSubmenuParams): ContextMenuItem | null {
  const isContextDeclaration = node.metadata.isContextDeclaration === true;

  const canDeclareAsContext = (() => {
    if (isContextDeclaration) return false;
    const ancestors = ancestorRegistry[node.id] || [];
    const parentId = ancestors[ancestors.length - 1];
    const parent = parentId ? nodes[parentId] : null;
    return parent?.metadata.isBlueprint === true;
  })();

  const handleDeclareAsContext = () => {
    openIconPicker(null, (selection) => {
      actions.declareAsContext(node.id, selection.icon, selection.color);
    });
  };

  const handleRemoveContextDeclaration = () => {
    actions.removeContextDeclaration(node.id);
  };

  // Only show if we have something to display
  if (!canDeclareAsContext && !isContextDeclaration) {
    return null;
  }

  const submenuItems: ContextMenuItem[] = [];

  if (canDeclareAsContext) {
    submenuItems.push({
      label: 'Declare as context',
      onClick: handleDeclareAsContext,
    });
  }

  if (isContextDeclaration) {
    submenuItems.push({
      label: 'Remove context declaration',
      onClick: handleRemoveContextDeclaration,
    });
  }

  return {
    label: 'Context',
    submenu: submenuItems,
  };
}
