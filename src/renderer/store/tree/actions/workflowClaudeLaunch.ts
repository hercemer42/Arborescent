import { logger } from '../../../services/logger';
import type { AutonomousSendSource } from './workflowExecutionActions';

interface ClaudeLaunchState {
  workflowSessionMap: Record<string, string>;
}

export interface ClaudeLaunchManager {
  launchIfNeededThenSend(nodeId: string, terminalId: string, bindingSource?: AutonomousSendSource): void;
  onSessionStartConfirmed(terminalId: string, runningNodeId: string): void;
  clearPending(nodeId: string): void;
}

export interface ClaudeLaunchManagerDeps {
  get: () => ClaudeLaunchState;
  sendPrompt: (nodeId: string, terminalId: string, bindingSource?: AutonomousSendSource) => void;
}

export function createClaudeLaunchManager(deps: ClaudeLaunchManagerDeps): ClaudeLaunchManager {
  const { get, sendPrompt } = deps;
  const pendingLaunch = new Map<string, { nodeId: string; bindingSource?: AutonomousSendSource }>();

  function terminalHasSession(terminalId: string): boolean {
    const { workflowSessionMap } = get();
    for (const tid of Object.values(workflowSessionMap)) {
      if (tid === terminalId) return true;
    }
    return false;
  }

  function launchIfNeededThenSend(nodeId: string, terminalId: string, bindingSource?: AutonomousSendSource): void {
    if (!nodeId || !terminalId) return;

    if (terminalHasSession(terminalId)) {
      sendPrompt(nodeId, terminalId, bindingSource);
      return;
    }

    pendingLaunch.set(terminalId, { nodeId, bindingSource });
    void Promise.resolve(window.electron.terminalWrite(terminalId, 'claude\r')).catch((error) => {
      logger.error('Failed to write claude\\r for auto-launch', error as Error, 'WorkflowExecution');
      pendingLaunch.delete(terminalId);
    });
  }

  function onSessionStartConfirmed(terminalId: string, runningNodeId: string): void {
    const pending = pendingLaunch.get(terminalId);
    if (!pending) return;
    pendingLaunch.delete(terminalId);
    const targetNodeId = runningNodeId && runningNodeId.length > 0 ? runningNodeId : pending.nodeId;
    sendPrompt(targetNodeId, terminalId, pending.bindingSource);
  }

  function clearPending(nodeId: string): void {
    for (const [terminalId, pending] of Array.from(pendingLaunch.entries())) {
      if (pending.nodeId === nodeId) {
        pendingLaunch.delete(terminalId);
      }
    }
  }

  return { launchIfNeededThenSend, onSessionStartConfirmed, clearPending };
}
