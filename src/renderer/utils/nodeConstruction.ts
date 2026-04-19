import type { TreeNode } from '../../shared/types';

/**
 * TreeNode construction primitives. Leaf module so markdown.ts can
 * import createTreeNode without going through nodeHelpers (which
 * itself imports markdown for content export, forming a cycle).
 */

export interface CreateTreeNodeOptions {
  content?: string;
  children?: string[];
  metadata?: Record<string, unknown>;
}

export function createTreeNode(id: string, options: CreateTreeNodeOptions = {}): TreeNode {
  return {
    id,
    content: options.content ?? '',
    children: options.children ?? [],
    metadata: options.metadata ?? {},
  };
}

export function wrapNodesWithHiddenRoot(
  nodes: Record<string, TreeNode>,
  contentRootIds: string | string[],
  hiddenRootId: string = 'hidden-root',
): { nodes: Record<string, TreeNode>; rootNodeId: string } {
  const children = Array.isArray(contentRootIds) ? contentRootIds : [contentRootIds];
  return {
    nodes: {
      ...nodes,
      [hiddenRootId]: createTreeNode(hiddenRootId, {
        children,
      }),
    },
    rootNodeId: hiddenRootId,
  };
}
