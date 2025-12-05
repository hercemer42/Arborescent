import { useMemo, useCallback } from 'react';
import { TreeNode } from '../../../../shared/types';
import { ContextMenuItem } from '../../ui/ContextMenu';

interface UseBlueprintSubmenuProps {
  node: TreeNode;
  nodes: Record<string, TreeNode>;
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

export function useBlueprintSubmenu({
  node,
  nodes,
  onAddToBlueprint,
  onRemoveFromBlueprint,
}: UseBlueprintSubmenuProps): ContextMenuItem | null {
  const handleRemove = useCallback(() => {
    const hasChildren = hasDescendantBlueprints(node.id, nodes);
    if (hasChildren) {
      const confirmed = window.confirm(
        'This will also remove all descendant nodes from the blueprint. Continue?'
      );
      if (!confirmed) return;
    }
    onRemoveFromBlueprint();
  }, [node.id, nodes, onRemoveFromBlueprint]);

  return useMemo(() => {
    // Hide Blueprint menu for context declarations and context children
    // Their blueprint status is managed by the context system
    if (node.metadata.isContextDeclaration === true || node.metadata.isContextChild === true) {
      return null;
    }

    const isBlueprint = node.metadata.isBlueprint === true;

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
  }, [node, onAddToBlueprint, handleRemove]);
}
