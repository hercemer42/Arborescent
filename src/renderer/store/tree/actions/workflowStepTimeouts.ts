import type { WorkflowExecutionEntry } from '../../../utils/workflowHelpers';

export interface StepTimeoutManager {
  start(nodeId: string): void;
  clear(nodeId: string): void;
}

export interface StepTimeoutManagerDeps {
  /** Returns the configured per-step timeout, in minutes. Zero or negative disables the timer. */
  getTimeoutMinutes: () => number;
  /** Check, at firing time, whether the node is still running. Avoids firing warnings after stop/complete. */
  isStillRunning: (nodeId: string) => boolean;
  /** Called when a timer fires for a node that's still running. */
  onTimeout: (nodeId: string) => void;
}

/**
 * Per-node step-timeout manager for workflow execution. Keeps a private
 * Map of timers and exposes only start/clear — extracted from
 * createWorkflowExecutionActions so the callback boundary with
 * stopWorkflow (the user-facing "Stop" toast action) is explicit.
 */
export function createStepTimeoutManager(deps: StepTimeoutManagerDeps): StepTimeoutManager {
  const timeouts = new Map<string, ReturnType<typeof setTimeout>>();

  function start(nodeId: string): void {
    clear(nodeId);
    const minutes = deps.getTimeoutMinutes();
    if (minutes <= 0) return;
    timeouts.set(
      nodeId,
      setTimeout(() => {
        timeouts.delete(nodeId);
        if (!deps.isStillRunning(nodeId)) return;
        deps.onTimeout(nodeId);
      }, minutes * 60 * 1000),
    );
  }

  function clear(nodeId: string): void {
    const existing = timeouts.get(nodeId);
    if (existing) {
      clearTimeout(existing);
      timeouts.delete(nodeId);
    }
  }

  return { start, clear };
}

/**
 * Pure predicate (no closure state): does this node have a running entry?
 * Used by the timeout manager's isStillRunning callback.
 */
export function isNodeRunning(
  states: Record<string, WorkflowExecutionEntry>,
  nodeId: string,
): boolean {
  return states[nodeId]?.state === 'running';
}
