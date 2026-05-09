import type { WorkflowExecutionEntry } from '../../../utils/workflowHelpers';

export interface SessionSelectorState {
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>;
  collaboratingNodeId: string | null;
  collaborationSource: 'browser' | 'terminal' | null;
  collaboratingTerminalId: string | null;
}

export function selectActiveSessionNodeId(
  state: SessionSelectorState,
  activeTerminalId: string | null | undefined
): string | null {
  if (!activeTerminalId) return null;

  const runningStepNodeId = findRunningStepOnTerminal(state.workflowExecutionStates, activeTerminalId);
  if (runningStepNodeId) return runningStepNodeId;

  if (
    state.collaboratingNodeId &&
    state.collaborationSource === 'terminal' &&
    state.collaboratingTerminalId === activeTerminalId
  ) {
    return state.collaboratingNodeId;
  }

  return null;
}

function findRunningStepOnTerminal(
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>,
  terminalId: string
): string | null {
  for (const [nodeId, entry] of Object.entries(workflowExecutionStates)) {
    if (entry.state === 'running' && entry.terminalTabId === terminalId) {
      return nodeId;
    }
  }
  return null;
}
