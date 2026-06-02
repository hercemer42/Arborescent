import { TreeNode } from '../../../../shared/types';
import { logger } from '../../../services/logger';

interface SessionMapState {
  workflowSessionMap?: Record<string, string>;
}

export function collectBoundSessionIds(
  nodeIds: string[],
  nodes: Record<string, TreeNode>,
): string[] {
  const sessionIds: string[] = [];
  for (const id of nodeIds) {
    const sessionId = nodes[id]?.metadata.sessionId;
    if (typeof sessionId === 'string' && sessionId.length > 0) {
      sessionIds.push(sessionId);
    }
  }
  return sessionIds;
}

// A deleted node releases its session binding from both sources of truth: the
// renderer workflowSessionMap and the main-process SessionBindingRegistry. The
// sessionIds must be collected before the nodes leave the store, since deletion
// removes them before the disruption fires.
export function releaseSessionBindings<T extends SessionMapState>(
  sessionIds: string[],
  get: () => T,
  set: (partial: Partial<T>) => void,
): void {
  if (sessionIds.length === 0) return;

  const released = new Set(sessionIds);
  const { workflowSessionMap } = get();
  if (workflowSessionMap) {
    const remaining = Object.fromEntries(
      Object.entries(workflowSessionMap).filter(([sessionId]) => !released.has(sessionId)),
    );
    if (Object.keys(remaining).length !== Object.keys(workflowSessionMap).length) {
      set({ workflowSessionMap: remaining } as Partial<T>);
    }
  }

  void window.electron
    .clearSessionBindings(sessionIds)
    .catch((error) =>
      logger.warn(
        `Failed to clear session bindings after node deletion: ${(error as Error).message}`,
        'SessionBindingCleanup',
      ),
    );
}
