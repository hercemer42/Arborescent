import { useMemo } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';

export interface AppliedContext {
  icon: string | undefined;
  color: string | undefined;
  name: string;
}

/**
 * Get the applied context for a node (explicit only, not inherited).
 * Used for gutter display - only shows on nodes where appliedContextId is set.
 */
export function useAppliedContext(node: TreeNode | undefined): AppliedContext | undefined {
  const nodeId = node?.id;
  const appliedContextId = node?.metadata.appliedContextId as string | undefined;

  const contextData = useStore((state) => {
    if (!nodeId || !appliedContextId) return null;

    const contextNode = state.nodes[appliedContextId];
    if (!contextNode) return null;

    return `${contextNode.metadata.blueprintIcon ?? ''}:${contextNode.metadata.blueprintColor ?? ''}:${contextNode.content}`;
  });

  return useMemo(() => {
    if (!contextData) return undefined;

    const [icon, color, ...contentParts] = contextData.split(':');
    return {
      icon: icon || undefined,
      color: color || undefined,
      name: contentParts.join(':'),
    };
  }, [contextData]);
}

/**
 * @deprecated Use useAppliedContext instead
 * Legacy hook for backwards compatibility - returns empty array
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useAppliedContexts(node: TreeNode | undefined): AppliedContext[] {
  return [];
}

/**
 * @deprecated Execute/collaborate contexts are no longer shown in gutter
 * Legacy hook for backwards compatibility
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function useActionContexts(node: TreeNode | undefined): { executeContext: undefined; collaborateContext: undefined } {
  return { executeContext: undefined, collaborateContext: undefined };
}

