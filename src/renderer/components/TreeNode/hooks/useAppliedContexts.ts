import { useMemo } from 'react';
import { TreeNode } from '../../../../shared/types';

export interface AppliedContext {
  icon: string | undefined;
  name: string;
}

export function useAppliedContexts(
  node: TreeNode | undefined,
  nodes: Record<string, TreeNode>
): AppliedContext[] {
  return useMemo(() => {
    if (!node) return [];

    const appliedContextIds = (node.metadata.appliedContextIds as string[]) || [];

    return appliedContextIds
      .map(contextId => {
        const contextNode = nodes[contextId];
        if (!contextNode) return null;
        return {
          icon: contextNode.metadata.contextIcon as string | undefined,
          name: contextNode.content,
        };
      })
      .filter((ctx): ctx is AppliedContext => ctx !== null);
  }, [node, nodes]);
}
