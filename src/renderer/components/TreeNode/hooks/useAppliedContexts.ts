import { useMemo } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';
import { getActiveContextId } from '../../../utils/nodeHelpers';

export interface AppliedContext {
  icon: string | undefined;
  color: string | undefined;
  name: string;
}


export function useAppliedContexts(node: TreeNode | undefined): AppliedContext[] {
  const appliedContextIds = (node?.metadata.appliedContextIds as string[]) || [];

  const contextNodesData = useStore((state) => {
    if (appliedContextIds.length === 0) return null;

    const parts: string[] = [];
    for (const contextId of appliedContextIds) {
      const contextNode = state.nodes[contextId];
      if (contextNode) {
        parts.push(`${contextId}:${contextNode.metadata.blueprintIcon ?? ''}:${contextNode.metadata.blueprintColor ?? ''}:${contextNode.content}`);
      }
    }
    return parts.join('|');
  });

  return useMemo(() => {
    if (!contextNodesData) return [];

    const parts = contextNodesData.split('|');
    return parts.map(part => {
      const [, icon, color, ...contentParts] = part.split(':');
      return {
        icon: icon || undefined,
        color: color || undefined,
        name: contentParts.join(':'),
      };
    });
  }, [contextNodesData]);
}

export function useActiveContext(node: TreeNode | undefined): AppliedContext | undefined {
  const appliedContextIds = (node?.metadata.appliedContextIds as string[]) || [];
  const nodeId = node?.id;

  const activeContextData = useStore((state) => {
    if (!nodeId || appliedContextIds.length === 0) return null;

    const activeContextId = getActiveContextId(nodeId, state.nodes, state.ancestorRegistry);
    if (!activeContextId) return null;

    const contextNode = state.nodes[activeContextId];
    if (!contextNode) return null;

    return `${contextNode.metadata.blueprintIcon ?? ''}:${contextNode.metadata.blueprintColor ?? ''}:${contextNode.content}`;
  });

  return useMemo(() => {
    if (!activeContextData) return undefined;

    const [icon, color, ...contentParts] = activeContextData.split(':');
    return {
      icon: icon || undefined,
      color: color || undefined,
      name: contentParts.join(':'),
    };
  }, [activeContextData]);
}

