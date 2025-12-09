import { useMemo } from 'react';
import { TreeNode } from '../../../shared/types';

/**
 * Get all nodes matching a search query in tree order (depth-first).
 * Searches all nodes regardless of collapsed state.
 */
function getMatchingNodeIds(
  query: string,
  nodes: Record<string, TreeNode>,
  rootNodeId: string
): string[] {
  if (!query.trim()) return [];

  const lowerQuery = query.toLowerCase();
  const matches: string[] = [];

  function traverse(nodeId: string): void {
    const node = nodes[nodeId];
    if (!node) return;

    // Check if node content matches (case-insensitive)
    if (node.content.toLowerCase().includes(lowerQuery)) {
      matches.push(nodeId);
    }

    // Traverse children in order
    for (const childId of node.children) {
      traverse(childId);
    }
  }

  traverse(rootNodeId);
  return matches;
}

/**
 * Hook to compute search matches from nodes.
 * Memoized to avoid recomputing on every render.
 */
export function useSearchMatches(
  query: string,
  nodes: Record<string, TreeNode>,
  rootNodeId: string
): string[] {
  return useMemo(
    () => getMatchingNodeIds(query, nodes, rootNodeId),
    [query, nodes, rootNodeId]
  );
}
