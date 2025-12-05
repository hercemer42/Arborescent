import { useMemo } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';

/**
 * Returns visible children filtered by blueprint mode.
 * In blueprint mode, only children with isBlueprint=true are shown.
 */
export function useVisibleChildren(children: string[] | undefined): string[] {
  const blueprintModeEnabled = useStore((state) => state.blueprintModeEnabled);

  // Only subscribe to relevant child nodes' isBlueprint status when in blueprint mode
  const childBlueprintStatus = useStore((state) => {
    if (!children || !blueprintModeEnabled) return null;
    // Return a string key that changes only when blueprint status of children changes
    return children.map(id => state.nodes[id]?.metadata.isBlueprint ? '1' : '0').join('');
  });

  return useMemo(() => {
    if (!children) return [];
    if (!blueprintModeEnabled) return children;
    if (!childBlueprintStatus) return children;
    // Filter based on the status string
    return children.filter((_, index) => childBlueprintStatus[index] === '1');
  }, [children, blueprintModeEnabled, childBlueprintStatus]);
}

/**
 * Returns visible children for a specific node, filtered by blueprint mode.
 */
export function useNodeVisibleChildren(node: TreeNode | undefined): string[] {
  const blueprintModeEnabled = useStore((state) => state.blueprintModeEnabled);
  const children = node?.children;

  // Only subscribe to relevant child nodes' isBlueprint status when in blueprint mode
  const childBlueprintStatus = useStore((state) => {
    if (!children || !blueprintModeEnabled) return null;
    // Return a string key that changes only when blueprint status of children changes
    return children.map(id => state.nodes[id]?.metadata.isBlueprint ? '1' : '0').join('');
  });

  return useMemo(() => {
    if (!children) return [];
    if (!blueprintModeEnabled) return children;
    if (!childBlueprintStatus) return children;
    // Filter based on the status string
    return children.filter((_, index) => childBlueprintStatus[index] === '1');
  }, [children, blueprintModeEnabled, childBlueprintStatus]);
}
