import type { WorkflowExecutionEntry } from '../../../utils/workflowHelpers';

export interface SessionSelectorState {
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>;
  collaboratingNodeId: string | null;
  collaborationSource: 'browser' | 'terminal' | null;
  collaboratingTerminalId: string | null;
  terminalOrigins?: Record<string, string>;
}

export function selectActiveSessionNodeId(
  state: SessionSelectorState,
  activeTerminalId: string | null | undefined
): string | null {
  if (!activeTerminalId) return null;

  const activeStepNodeId = findActiveStepOnTerminal(state.workflowExecutionStates, activeTerminalId);
  if (activeStepNodeId) return activeStepNodeId;

  if (
    state.collaboratingNodeId &&
    state.collaborationSource === 'terminal' &&
    state.collaboratingTerminalId === activeTerminalId
  ) {
    return state.collaboratingNodeId;
  }

  return state.terminalOrigins?.[activeTerminalId] ?? null;
}

function findActiveStepOnTerminal(
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>,
  terminalId: string
): string | null {
  for (const [nodeId, entry] of Object.entries(workflowExecutionStates)) {
    if (entry.terminalTabId !== terminalId) continue;
    if (entry.state === 'running' || entry.state === 'awaiting-validation') {
      return nodeId;
    }
  }
  return null;
}
