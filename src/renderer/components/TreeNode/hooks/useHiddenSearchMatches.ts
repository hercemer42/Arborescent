import { useMemo } from 'react';
import { useSearchStore } from '../../../store/search/searchStore';
import { useStore } from '../../../store/tree/useStore';

export function useHiddenSearchMatches(nodeId: string, isCollapsed: boolean): boolean {
  const matchingNodeIdsSet = useSearchStore((state) => state.matchingNodeIdsSet);
  const nodes = useStore((state) => state.nodes);

  return useMemo(() => {
    if (!isCollapsed || matchingNodeIdsSet.size === 0) {
      return false;
    }

    function hasMatchingDescendant(id: string): boolean {
      const node = nodes[id];
      if (!node) return false;

      for (const childId of node.children) {
        if (matchingNodeIdsSet.has(childId)) {
          return true;
        }
        if (hasMatchingDescendant(childId)) {
          return true;
        }
      }
      return false;
    }

    return hasMatchingDescendant(nodeId);
  }, [nodeId, isCollapsed, matchingNodeIdsSet, nodes]);
}
