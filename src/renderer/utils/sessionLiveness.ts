import type { TreeNode } from '../../shared/types';

export type SessionLivenessResult = 'no-session' | 'alive-attached' | 'alive-detached';

export function getSessionLiveness(
  node: TreeNode,
  workflowSessionMap: Record<string, string>,
): SessionLivenessResult {
  const sessionId = node.metadata.sessionId;
  if (!sessionId) return 'no-session';
  return Object.prototype.hasOwnProperty.call(workflowSessionMap, sessionId)
    ? 'alive-attached'
    : 'alive-detached';
}
