import { useMemo } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';

function useChildVisibilityStatus(children: string[] | undefined): string | null {
  const blueprintModeEnabled = useStore((state) => state.blueprintModeEnabled);
  const summaryModeEnabled = useStore((state) => state.summaryModeEnabled);

  const blueprintStatus = useStore((state) => {
    if (!children || !blueprintModeEnabled || summaryModeEnabled) return null;
    return children.map(id => state.nodes[id]?.metadata.isBlueprint ? '1' : '0').join('');
  });

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
