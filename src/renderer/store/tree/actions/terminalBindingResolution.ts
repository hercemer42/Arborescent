import type { TreeNode } from '../../../../shared/types';
import type { WorkflowExecutionEntry } from '../../../utils/workflowHelpers';
import type { RendererBindingFact } from '../../../../shared/utils/bindingAuthority';
import { findLiveNodeWithSessionId } from '../selectors/activeSessionNodeId';
import { useTerminalStore } from '../../terminal/terminalStore';

// Typed against BINDING_AUTHORITY: this resolver may consult only facts the
// table assigns to the renderer. Hint-only facts never answer routing on
// their own: the persisted sessionId may key an answer only after
// re-validation against live state (node present, chain unbroken), and the
// origin bookmark only gates capture — it is never the returned binding.
export const CONSULTED_BINDING_FACTS: readonly RendererBindingFact[] = [
  'session-to-terminal',
  'terminal-to-running-node',
  'terminal-to-origin-node',
  'persisted-session-hint',
];

export type BindingResolutionState = {
  nodes: Record<string, TreeNode>;
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>;
  workflowSessionMap: Record<string, string>;
  terminalNodeAssignments?: Record<string, string>;
};

function isLiveExecutionOnTerminal(
  entry: WorkflowExecutionEntry | undefined,
  terminalId: string,
): boolean {
  return (
    entry !== undefined &&
    (entry.state === 'running' || entry.state === 'awaiting-validation') &&
    entry.terminalTabId === terminalId
  );
}

// terminalNodeAssignments is a fast-path index, not the source of truth for
// liveness: an entry can outlive the node's running state if a node stops
// through a path that does not release it. Re-validate against
// workflowExecutionStates so a stale assignment never reports the terminal as
// hosting a running node — the false "already assigned" guard rejection.
export function findRunningNodeOnTerminal(
  get: () => BindingResolutionState,
  terminalId: string,
): string | null {
  const { workflowExecutionStates, terminalNodeAssignments } = get();
  const assignedNodeId = terminalNodeAssignments?.[terminalId];
  if (
    assignedNodeId &&
    isLiveExecutionOnTerminal(workflowExecutionStates[assignedNodeId], terminalId)
  ) {
    return assignedNodeId;
  }
  for (const [nodeId, entry] of Object.entries(workflowExecutionStates)) {
    if (isLiveExecutionOnTerminal(entry, terminalId)) {
      return nodeId;
    }
  }
  return null;
}

export function findCapturableNodeForTerminal(
  get: () => BindingResolutionState,
  terminalId: string,
  incomingSessionId: string,
): string | null {
  const running = findRunningNodeOnTerminal(get, terminalId);
  if (running) return running;
  const originNodeId = useTerminalStore
    .getState()
    .terminals.find((t) => t.id === terminalId)?.originNodeId;
  if (!originNodeId) return null;
  const originNode = get().nodes[originNodeId];
  if (!originNode) return null;
  const bookmarked = originNode.metadata.sessionId;
  if (
    typeof bookmarked === 'string' &&
    bookmarked.length > 0 &&
    bookmarked !== incomingSessionId &&
    originNode.metadata.brokenChain !== true
  ) {
    return null;
  }
  return originNodeId;
}

// The node that owns the live session currently running on the terminal. A
// stale originNodeId (a "blue bar" with no live session) is intentionally not
// treated as a binding — only an active session counts as a rebind target.
export function findSessionBoundNodeForTerminal(
  get: () => BindingResolutionState,
  terminalId: string,
): string | null {
  const { workflowSessionMap } = get();
  for (const [sessionId, boundTerminalId] of Object.entries(workflowSessionMap)) {
    if (boundTerminalId !== terminalId) continue;
    const owner = findLiveNodeWithSessionId(get().nodes, sessionId);
    if (owner) return owner;
  }
  return null;
}
