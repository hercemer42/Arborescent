import { useMemo } from 'react';
import { useSearchStore } from '../../../store/search/searchStore';
import { useStore } from '../../../store/tree/useStore';

/**
 * Hook to determine if a collapsed node has search matches in its descendants.
 * Returns true if the node is collapsed and any of its descendants match the search query.
 */
export function useHiddenSearchMatches(nodeId: string, isCollapsed: boolean): boolean {
  const matchingNodeIdsSet = useSearchStore((state) => state.matchingNodeIdsSet);
  const nodes = useStore((state) => state.nodes);

  return useMemo(() => {
    // Only relevant for collapsed nodes with active search
    if (!isCollapsed || matchingNodeIdsSet.size === 0) {
      return false;
    }

    function hasMatchingDescendant(id: string): boolean {
      const node = nodes[id];
      if (!node) return false;

      for (const childId of node.children) {
        // Check if child matches
        if (matchingNodeIdsSet.has(childId)) {
          return true;
        }
        // Recursively check descendants
        if (hasMatchingDescendant(childId)) {
          return true;
        }
      }
      return false;
    }

    return hasMatchingDescendant(nodeId);
  }, [nodeId, isCollapsed, matchingNodeIdsSet, nodes]);
}
