import type { TreeNode } from '../../../../shared/types';
import type { WorkflowExecutionEntry } from '../../../utils/workflowHelpers';

export interface SessionSelectorState {
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>;
  collaboratingNodeId: string | null;
  collaborationSource: 'browser' | 'terminal' | null;
  collaboratingTerminalId: string | null;
  workflowSessionMap?: Record<string, string>;
  nodes?: Record<string, TreeNode>;
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

  return findNodeOwningTerminalSession(state, activeTerminalId);
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

function findNodeOwningTerminalSession(
  state: SessionSelectorState,
  terminalId: string,
): string | null {
  const sessionId = reverseLookupSessionId(state.workflowSessionMap, terminalId);
  if (!sessionId) return null;
  return findLiveNodeWithSessionId(state.nodes, sessionId);
}

function reverseLookupSessionId(
  workflowSessionMap: Record<string, string> | undefined,
  terminalId: string,
): string | null {
  if (!workflowSessionMap) return null;
  for (const [sessionId, mappedTerminalId] of Object.entries(workflowSessionMap)) {
    if (mappedTerminalId === terminalId) return sessionId;
  }
  return null;
}

function findLiveNodeWithSessionId(
  nodes: Record<string, TreeNode> | undefined,
  sessionId: string,
): string | null {
  if (!nodes) return null;
  for (const [nodeId, node] of Object.entries(nodes)) {
    if (node.metadata.sessionId !== sessionId) continue;
    if (node.metadata.brokenChain === true) continue;
    return nodeId;
  }
  return null;
}
