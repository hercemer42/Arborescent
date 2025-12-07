import { useMemo } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';

export interface AppliedContext {
  icon: string | undefined;
  color: string | undefined;
  name: string;
}

export interface ActionContexts {
  executeContext: AppliedContext | undefined;
  collaborateContext: AppliedContext | undefined;
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

export function useActionContexts(node: TreeNode | undefined): ActionContexts {
  const nodeId = node?.id;

  const contextData = useStore((state) => {
    if (!nodeId) return null;

    const currentNode = state.nodes[nodeId];
    if (!currentNode) return null;

    // Only show explicit selections (not inherited) for gutter display
    const executeContextId = currentNode.metadata.activeExecuteContextId as string | undefined;
    const collaborateContextId = currentNode.metadata.activeCollaborateContextId as string | undefined;

    if (!executeContextId && !collaborateContextId) return null;

    const parts: string[] = [];

    if (executeContextId && state.nodes[executeContextId]) {
      const contextNode = state.nodes[executeContextId];
      parts.push(`execute:${contextNode.metadata.blueprintIcon ?? ''}:${contextNode.metadata.blueprintColor ?? ''}:${contextNode.content}`);
    }

    if (collaborateContextId && state.nodes[collaborateContextId]) {
      const contextNode = state.nodes[collaborateContextId];
      parts.push(`collaborate:${contextNode.metadata.blueprintIcon ?? ''}:${contextNode.metadata.blueprintColor ?? ''}:${contextNode.content}`);
    }

    return parts.length > 0 ? parts.join('|') : null;
  });

  return useMemo(() => {
    const result: ActionContexts = {
      executeContext: undefined,
      collaborateContext: undefined,
    };

    if (!contextData) return result;

    const parts = contextData.split('|');
    for (const part of parts) {
      const [actionType, icon, color, ...contentParts] = part.split(':');
      const context: AppliedContext = {
        icon: icon || undefined,
        color: color || undefined,
        name: contentParts.join(':'),
      };

      if (actionType === 'execute') {
        result.executeContext = context;
      } else if (actionType === 'collaborate') {
        result.collaborateContext = context;
      }
    }

    return result;
  }, [contextData]);
}

