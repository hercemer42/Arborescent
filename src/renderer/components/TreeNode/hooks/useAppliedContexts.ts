import { useMemo } from 'react';
import { useStore } from '../../../store/tree/useStore';
import { TreeNode } from '../../../../shared/types';
import { BASIC_EXECUTE_CONTEXT_ID, BASIC_REVIEW_CONTEXT_ID, isSyntheticContextId } from '../../../utils/nodeHelpers';

export interface AppliedContext {
  icon: string | undefined;
  color: string | undefined;
  name: string;
  collaborate: boolean;
  execute: boolean;
  id?: string;
}

function flagsLabel(collaborate: boolean, execute: boolean): string {
  if (collaborate && execute) return 'Collaborate & Execute';
  if (execute) return 'Execute';
  if (collaborate) return 'Collaborate';
  return 'Action';
}

export { flagsLabel };

export function useAppliedContext(node: TreeNode | undefined): AppliedContext | undefined {
  const nodeId = node?.id;
  const appliedContextId = node?.metadata.appliedContextId as string | undefined;

  const contextData = useStore((state) => {
    if (!nodeId || !appliedContextId) return null;

    if (appliedContextId === BASIC_EXECUTE_CONTEXT_ID) {
      return 'Zap::1:1:Basic execution';
    }

    if (appliedContextId === BASIC_REVIEW_CONTEXT_ID) {
      return 'Eye::1:0:Basic review';
    }

    const contextNode = state.nodes[appliedContextId];
    if (!contextNode) return null;

    const collaborateRaw = contextNode.metadata.collaborate;
    const executeRaw = contextNode.metadata.execute;
    let collaborate: string;
    let execute: string;
    if (typeof collaborateRaw !== 'boolean' && typeof executeRaw !== 'boolean') {
      collaborate = '1';
      execute = '0';
    } else {
      collaborate = collaborateRaw === true ? '1' : '0';
      execute = executeRaw === true ? '1' : '0';
    }
    return `${contextNode.metadata.blueprintIcon ?? ''}:${contextNode.metadata.blueprintColor ?? ''}:${collaborate}:${execute}:${contextNode.content}`;
  });

  return useMemo(() => {
    if (!contextData) return undefined;

    const [icon, color, collaborateFlag, executeFlag, ...contentParts] = contextData.split(':');
    const id = appliedContextId && !isSyntheticContextId(appliedContextId) ? appliedContextId : undefined;
    return {
      icon: icon || undefined,
      color: color || undefined,
      collaborate: collaborateFlag === '1',
      execute: executeFlag === '1',
      name: contentParts.join(':'),
      id,
    };
  }, [contextData, appliedContextId]);
}

