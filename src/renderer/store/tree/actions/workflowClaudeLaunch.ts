import { logger } from '../../../services/logger';

interface ClaudeLaunchState {
  workflowSessionMap: Record<string, string>;
}

export interface ClaudeLaunchManager {
  launchIfNeededThenSend(nodeId: string, terminalId: string): void;
  onSessionStartConfirmed(terminalId: string, runningNodeId: string): void;
  clearPending(nodeId: string): void;
}

export interface ClaudeLaunchManagerDeps {
  get: () => ClaudeLaunchState;
  sendPrompt: (nodeId: string, terminalId: string) => void;
}

export function createClaudeLaunchManager(deps: ClaudeLaunchManagerDeps): ClaudeLaunchManager {
  const { get, sendPrompt } = deps;
  const pendingLaunch = new Map<string, string>();

  function terminalHasSession(terminalId: string): boolean {
    const { workflowSessionMap } = get();
    for (const tid of Object.values(workflowSessionMap)) {
      if (tid === terminalId) return true;
    }
    return false;
  }

  function launchIfNeededThenSend(nodeId: string, terminalId: string): void {
    if (!nodeId || !terminalId) return;

    if (terminalHasSession(terminalId)) {
      sendPrompt(nodeId, terminalId);
      return;
    }

    pendingLaunch.set(terminalId, nodeId);
    void Promise.resolve(window.electron.terminalWrite(terminalId, 'claude\r')).catch((error) => {
      logger.error('Failed to write claude\\r for auto-launch', error as Error, 'WorkflowExecution');
      pendingLaunch.delete(terminalId);
    });
  }

  function onSessionStartConfirmed(terminalId: string, runningNodeId: string): void {
    const pendingNodeId = pendingLaunch.get(terminalId);
    if (!pendingNodeId) return;
    pendingLaunch.delete(terminalId);
    const targetNodeId = runningNodeId && runningNodeId.length > 0 ? runningNodeId : pendingNodeId;
    sendPrompt(targetNodeId, terminalId);
  }

  function clearPending(nodeId: string): void {
    for (const [terminalId, pendingNodeId] of Array.from(pendingLaunch.entries())) {
      if (pendingNodeId === nodeId) {
        pendingLaunch.delete(terminalId);
      }
    }
  }

  return { launchIfNeededThenSend, onSessionStartConfirmed, clearPending };
}
