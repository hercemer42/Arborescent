import { useMemo } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';
import { BASIC_EXECUTE_CONTEXT_ID, BASIC_REVIEW_CONTEXT_ID } from '../../../utils/nodeHelpers';

export interface AppliedContext {
  icon: string | undefined;
  color: string | undefined;
  name: string;
  mode: 'collaborate' | 'execute';
}

export function useAppliedContext(node: TreeNode | undefined): AppliedContext | undefined {
  const nodeId = node?.id;
  const appliedContextId = node?.metadata.appliedContextId as string | undefined;

  const contextData = useStore((state) => {
    if (!nodeId || !appliedContextId) return null;

    if (appliedContextId === BASIC_EXECUTE_CONTEXT_ID) {
      return 'Zap::execute:Basic execution';
    }

    if (appliedContextId === BASIC_REVIEW_CONTEXT_ID) {
      return 'Eye::collaborate:Basic review';
    }

    const contextNode = state.nodes[appliedContextId];
    if (!contextNode) return null;

    const mode = (contextNode.metadata.contextMode as string) || 'collaborate';
    return `${contextNode.metadata.blueprintIcon ?? ''}:${contextNode.metadata.blueprintColor ?? ''}:${mode}:${contextNode.content}`;
  });

  return useMemo(() => {
    if (!contextData) return undefined;

    const [icon, color, mode, ...contentParts] = contextData.split(':');
    return {
      icon: icon || undefined,
      color: color || undefined,
      mode: (mode as 'collaborate' | 'execute') || 'collaborate',
      name: contentParts.join(':'),
    };
  }, [contextData]);
}

