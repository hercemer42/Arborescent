import { logger } from '../../../services/logger';
import type { AutonomousSendSource } from './workflowExecutionActions';

const RESUME_READY_TIMEOUT_MS = 30000;

interface ClaudeLaunchState {
  workflowSessionMap: Record<string, string>;
}

export interface ClaudeLaunchManager {
  launchIfNeededThenSend(nodeId: string, terminalId: string, bindingSource?: AutonomousSendSource): void;
  deferSendUntilSessionStart(nodeId: string, terminalId: string, bindingSource?: AutonomousSendSource): void;
  onSessionStartConfirmed(terminalId: string, runningNodeId: string): void;
  clearPending(nodeId: string): void;
}

export interface ClaudeLaunchManagerDeps {
  get: () => ClaudeLaunchState;
  sendPrompt: (nodeId: string, terminalId: string, bindingSource?: AutonomousSendSource) => void;
  // Fires a resume-deferred send once the resumed session is live. Routed through
  // the clear-before-send path so a clearSession step still clears — now safely
  // after `claude --resume` has finished, not racing its startup. Falls back to
  // sendPrompt when not provided.
  sendAfterResume?: (nodeId: string, terminalId: string, bindingSource?: AutonomousSendSource) => void;
  // Invoked when a resumed session never announces SessionStart within the bound,
  // so the workflow surfaces an error instead of waiting forever.
  onResumeTimeout?: (nodeId: string, terminalId: string) => void;
}

interface PendingSend {
  nodeId: string;
  bindingSource?: AutonomousSendSource;
  fromResume: boolean;
  timer?: ReturnType<typeof setTimeout>;
}

export function createClaudeLaunchManager(deps: ClaudeLaunchManagerDeps): ClaudeLaunchManager {
  const { get, sendPrompt, sendAfterResume, onResumeTimeout } = deps;
  const pendingSends = new Map<string, PendingSend>();

  function terminalHasSession(terminalId: string): boolean {
    const { workflowSessionMap } = get();
    for (const tid of Object.values(workflowSessionMap)) {
      if (tid === terminalId) return true;
    }
    return false;
  }

  function discardPending(terminalId: string): void {
    const pending = pendingSends.get(terminalId);
    if (pending?.timer) clearTimeout(pending.timer);
    pendingSends.delete(terminalId);
  }

  function launchIfNeededThenSend(nodeId: string, terminalId: string, bindingSource?: AutonomousSendSource): void {
    if (!nodeId || !terminalId) return;

    if (terminalHasSession(terminalId)) {
      sendPrompt(nodeId, terminalId, bindingSource);
      return;
    }

    pendingSends.set(terminalId, { nodeId, bindingSource, fromResume: false });
    void Promise.resolve(window.electron.terminalWrite(terminalId, 'claude\r')).catch((error) => {
      logger.error('Failed to write claude\\r for auto-launch', error as Error, 'WorkflowExecution');
      discardPending(terminalId);
    });
  }

  // The resume path has already written `claude --resume <id>`, so this only
  // registers the pending send and waits for the resumed session's SessionStart —
  // it never writes `claude\r`. A bounded timeout surfaces a clear error rather
  // than hanging if the session never comes up.
  function deferSendUntilSessionStart(nodeId: string, terminalId: string, bindingSource?: AutonomousSendSource): void {
    if (!nodeId || !terminalId) return;
    discardPending(terminalId);
    const timer = setTimeout(() => {
      pendingSends.delete(terminalId);
      onResumeTimeout?.(nodeId, terminalId);
    }, RESUME_READY_TIMEOUT_MS);
    pendingSends.set(terminalId, { nodeId, bindingSource, fromResume: true, timer });
  }

  function onSessionStartConfirmed(terminalId: string, runningNodeId: string): void {
    const pending = pendingSends.get(terminalId);
    if (!pending) return;
    if (pending.timer) clearTimeout(pending.timer);
    pendingSends.delete(terminalId);
    const targetNodeId = runningNodeId && runningNodeId.length > 0 ? runningNodeId : pending.nodeId;
    const send = pending.fromResume && sendAfterResume ? sendAfterResume : sendPrompt;
    send(targetNodeId, terminalId, pending.bindingSource);
  }

  // Also the cleanup path for the resume-wait timer: handleTerminalClosed calls this
  // when the user closes the tab mid-resume, so discardPending must clear the timer.
  function clearPending(nodeId: string): void {
    for (const [terminalId, pending] of Array.from(pendingSends.entries())) {
      if (pending.nodeId === nodeId) {
        discardPending(terminalId);
      }
    }
  }

  return { launchIfNeededThenSend, deferSendUntilSessionStart, onSessionStartConfirmed, clearPending };
}
