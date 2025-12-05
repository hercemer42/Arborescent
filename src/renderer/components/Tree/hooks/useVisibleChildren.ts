import { useMemo } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';

/**
 * Returns visible children filtered by blueprint mode.
 * In blueprint mode, only children with isBlueprint=true are shown.
 */
export function useVisibleChildren(children: string[] | undefined): string[] {
  const nodes = useStore((state) => state.nodes);
  const blueprintModeEnabled = useStore((state) => state.blueprintModeEnabled);

  return useMemo(() => {
    if (!children) return [];
    if (!blueprintModeEnabled) return children;
    return children.filter((childId) => nodes[childId]?.metadata.isBlueprint === true);
  }, [children, blueprintModeEnabled, nodes]);
}

/**
 * Returns visible children for a specific node, filtered by blueprint mode.
 */
export function useNodeVisibleChildren(node: TreeNode | undefined): string[] {
  const nodes = useStore((state) => state.nodes);
  const blueprintModeEnabled = useStore((state) => state.blueprintModeEnabled);

  return useMemo(() => {
    if (!node) return [];
    if (!blueprintModeEnabled) return node.children;
    return node.children.filter((childId) => nodes[childId]?.metadata.isBlueprint === true);
  }, [node, blueprintModeEnabled, nodes]);
}
