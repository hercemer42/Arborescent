import { useMemo } from 'react';
import { TreeNode } from '../../../shared/types';

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

    if (node.content.toLowerCase().includes(lowerQuery)) {
      matches.push(nodeId);
    }

    for (const childId of node.children) {
      traverse(childId);
    }
  }

  traverse(rootNodeId);
  return matches;
}

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
