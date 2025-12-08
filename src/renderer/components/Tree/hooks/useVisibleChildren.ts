import { useMemo } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';

/**
 * Compute visibility status string for children based on filter mode.
 */
function useChildVisibilityStatus(children: string[] | undefined): string | null {
  const blueprintModeEnabled = useStore((state) => state.blueprintModeEnabled);
  const summaryModeEnabled = useStore((state) => state.summaryModeEnabled);

  // Blueprint mode: check isBlueprint metadata
  const blueprintStatus = useStore((state) => {
    if (!children || !blueprintModeEnabled || summaryModeEnabled) return null;
    return children.map(id => state.nodes[id]?.metadata.isBlueprint ? '1' : '0').join('');
  });

  // Summary mode: use pre-computed visible set from store
  const summaryStatus = useStore((state) => {
    if (!children || !summaryModeEnabled) return null;
    const visibleIds = state.summaryVisibleNodeIds;
    if (!visibleIds) return null;
    return children.map(id => visibleIds.has(id) ? '1' : '0').join('');
  });

  if (summaryModeEnabled) return summaryStatus;
  if (blueprintModeEnabled) return blueprintStatus;
  return null;
}

/**
 * Returns visible children filtered by blueprint or summary mode.
 */
export function useVisibleChildren(children: string[] | undefined): string[] {
  const blueprintModeEnabled = useStore((state) => state.blueprintModeEnabled);
  const summaryModeEnabled = useStore((state) => state.summaryModeEnabled);
  const visibilityStatus = useChildVisibilityStatus(children);

  return useMemo(() => {
    if (!children) return [];
    if (!blueprintModeEnabled && !summaryModeEnabled) return children;
    if (!visibilityStatus) return children;
    return children.filter((_, index) => visibilityStatus[index] === '1');
  }, [children, blueprintModeEnabled, summaryModeEnabled, visibilityStatus]);
}

/**
 * Returns visible children for a specific node, filtered by blueprint or summary mode.
 */
export function useNodeVisibleChildren(node: TreeNode | undefined): string[] {
  const children = node?.children;
  const blueprintModeEnabled = useStore((state) => state.blueprintModeEnabled);
  const summaryModeEnabled = useStore((state) => state.summaryModeEnabled);
  const visibilityStatus = useChildVisibilityStatus(children);

  return useMemo(() => {
    if (!children) return [];
    if (!blueprintModeEnabled && !summaryModeEnabled) return children;
    if (!visibilityStatus) return children;
    return children.filter((_, index) => visibilityStatus[index] === '1');
  }, [children, blueprintModeEnabled, summaryModeEnabled, visibilityStatus]);
}
