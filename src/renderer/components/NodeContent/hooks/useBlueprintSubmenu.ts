import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';

interface BuildBlueprintSubmenuParams {
  node: TreeNode;
  getNodes: () => Record<string, TreeNode>;
  onAddToBlueprint: () => void;
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
  onAddToBlueprint,
  onRemoveFromBlueprint,
}: BuildBlueprintSubmenuParams): ContextMenuItem | null {
  // Hide Blueprint menu for context declarations and context children
  if (node.metadata.isContextDeclaration === true || node.metadata.isContextChild === true) {
    return null;
  }

  const isBlueprint = node.metadata.isBlueprint === true;

  const handleRemove = () => {
    const nodes = getNodes();
    const hasChildren = hasDescendantBlueprints(node.id, nodes);
    if (hasChildren) {
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
