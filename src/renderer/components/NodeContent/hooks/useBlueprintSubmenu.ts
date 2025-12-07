import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';
import { getIsContextChild } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../services/ancestry';

interface BuildBlueprintSubmenuParams {
  node: TreeNode;
  getNodes: () => Record<string, TreeNode>;
  getAncestorRegistry: () => AncestorRegistry;
  onAddToBlueprint: () => void;
  onAddToBlueprintWithDescendants: () => void;
  onRemoveFromBlueprint: () => void;
}

function hasDescendantBlueprints(nodeId: string, nodes: Record<string, TreeNode>): boolean {
  const node = nodes[nodeId];
  if (!node) return false;

  for (const childId of node.children) {
    const child = nodes[childId];
    if (child?.metadata.isBlueprint === true) return true;
    if (hasDescendantBlueprints(childId, nodes)) return true;
  }
  return false;
}

export function buildBlueprintSubmenu({
  node,
  getNodes,
  getAncestorRegistry,
  onAddToBlueprint,
  onAddToBlueprintWithDescendants,
  onRemoveFromBlueprint,
}: BuildBlueprintSubmenuParams): ContextMenuItem | null {
  // Hide Blueprint menu for context declarations and context children
  const isContextChild = getIsContextChild(node.id, getNodes(), getAncestorRegistry());
  if (node.metadata.isContextDeclaration === true || isContextChild) {
    return null;
  }

  const isBlueprint = node.metadata.isBlueprint === true;
  const hasChildren = node.children.length > 0;

  const handleRemove = () => {
    const nodes = getNodes();
    const hasDescendants = hasDescendantBlueprints(node.id, nodes);
    if (hasDescendants) {
      const confirmed = window.confirm(
        'This will also remove all descendant nodes from the blueprint. Continue?'
      );
      if (!confirmed) return;
    }
    onRemoveFromBlueprint();
  };

  const submenuItems: ContextMenuItem[] = [];

  if (!isBlueprint) {
    submenuItems.push({
      label: 'Add to Blueprint',
      onClick: onAddToBlueprint,
    });
    if (hasChildren) {
      submenuItems.push({
        label: 'Add with descendants',
        onClick: onAddToBlueprintWithDescendants,
      });
    }
  } else {
    submenuItems.push({
      label: 'Remove from Blueprint',
      onClick: handleRemove,
    });
  }

  return {
    label: 'Blueprint',
    submenu: submenuItems,
  };
}
