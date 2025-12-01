import { useMemo } from 'react';
import { TreeNode } from '../../../../shared/types';
import { getActiveContextId } from '../../../utils/nodeHelpers';
import { AncestorRegistry } from '../../../services/ancestry';

export interface AppliedContext {
  icon: string | undefined;
  color: string | undefined;
  name: string;
}

export interface BundledContext {
  icon: string | undefined;
  color: string | undefined;
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
          color: contextNode.metadata.contextColor as string | undefined,
          name: contextNode.content,
        };
      })
      .filter((ctx): ctx is AppliedContext => ctx !== null);
  }, [node, nodes]);
}

/**
 * Get the active context for a node only if it has directly applied contexts.
 * Returns undefined for nodes inheriting context from ancestors (context is shown on the ancestor instead).
 */
export function useActiveContext(
  node: TreeNode | undefined,
  nodes: Record<string, TreeNode>,
  ancestorRegistry: AncestorRegistry
): AppliedContext | undefined {
  return useMemo(() => {
    if (!node) return undefined;

    // Only show indicator if node has its own applied contexts (not inherited)
    const appliedContextIds = (node.metadata.appliedContextIds as string[]) || [];
    if (appliedContextIds.length === 0) {
      return undefined;
    }

    const activeContextId = getActiveContextId(node.id, nodes, ancestorRegistry);
    if (!activeContextId) return undefined;

    const contextNode = nodes[activeContextId];
    if (!contextNode) return undefined;

    return {
      icon: contextNode.metadata.contextIcon as string | undefined,
      color: contextNode.metadata.contextColor as string | undefined,
      name: contextNode.content,
    };
  }, [node, nodes, ancestorRegistry]);
}

/**
 * Get bundled contexts for a context declaration node.
 * Returns empty array for non-context declarations.
 */
export function useBundledContexts(
  node: TreeNode | undefined,
  nodes: Record<string, TreeNode>
): BundledContext[] {
  return useMemo(() => {
    if (!node) return [];

    // Only context declarations can have bundled contexts
    if (node.metadata.isContextDeclaration !== true) {
      return [];
    }

    const bundledContextIds = (node.metadata.bundledContextIds as string[]) || [];

    return bundledContextIds
      .map(contextId => {
        const contextNode = nodes[contextId];
        if (!contextNode) return null;
        return {
          icon: contextNode.metadata.contextIcon as string | undefined,
          color: contextNode.metadata.contextColor as string | undefined,
          name: contextNode.content,
        };
      })
      .filter((ctx): ctx is BundledContext => ctx !== null);
  }, [node, nodes]);
}
