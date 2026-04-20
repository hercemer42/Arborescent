import type { TreeNode } from '../../../../shared/types';
import type { AncestorRegistry } from '../../../utils/ancestry';
import type { WorkflowExecutionEntry } from '../../../utils/workflowHelpers';
import { getWorkflowStepPosition } from '../../../utils/workflowHelpers';
import { useToastStore } from '../../toast/toastStore';
import { logger } from '../../../services/logger';
import { notifyWorkflowEvent } from '../../../services/workflowNotification';

interface ClearSessionState {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: AncestorRegistry;
  workflowExecutionStates: Record<string, WorkflowExecutionEntry>;
}

export interface ClearSessionManager {
  maybeClearThenSend(nodeId: string, terminalId: string): void;
  onClearConfirmed(nodeId: string): void;
  clearPending(nodeId: string): void;
  clearAllPending(): void;
}

export interface ClearSessionManagerDeps {
  get: () => ClearSessionState;
  set: (partial: { workflowExecutionStates?: Record<string, WorkflowExecutionEntry> }) => void;
  sendPrompt: (nodeId: string, terminalId: string) => void;
  stopWorkflow: (nodeId: string) => void;
}

const CLEAR_TIMEOUT_MS = 5000;
const CLEAR_RETRY_CAP = 3;
const POST_CLEAR_SEND_DELAY_MS = 300;

/**
 * Per-node /clear-before-send manager. Owns the pendingClears map,
 * retry timers, and the "clearing" transient state. Extracted from
 * createWorkflowExecutionActions so the clear-retry lifecycle — which
 * parallels but does not share state with the prompt ACK lifecycle —
 * stays self-contained and auditable.
 */
export function createClearSessionManager(deps: ClearSessionManagerDeps): ClearSessionManager {
  const { get, set, sendPrompt, stopWorkflow } = deps;
  const pendingClears = new Map<string, { terminalId: string; attempts: number; timer: ReturnType<typeof setTimeout> }>();

  function clearPending(nodeId: string): void {
    const entry = pendingClears.get(nodeId);
    if (!entry) return;
    clearTimeout(entry.timer);
    pendingClears.delete(nodeId);
  }

  function clearAllPending(): void {
    for (const nodeId of Array.from(pendingClears.keys())) {
      clearPending(nodeId);
    }
  }

  function writeClearToTerminal(terminalId: string): Promise<void> {
    return window.electron.terminalWrite(terminalId, '/clear\r');
  }

  function registerPendingClear(nodeId: string, terminalId: string): void {
    const existing = pendingClears.get(nodeId);
    if (existing) clearTimeout(existing.timer);
    const attempts = existing ? existing.attempts + 1 : 1;

    const timer = setTimeout(() => {
      if (attempts >= CLEAR_RETRY_CAP) {
        failClearRetryCap(nodeId);
      } else {
        writeClearToTerminal(terminalId).catch((error) => {
          logger.error('Failed to retry /clear write', error as Error, 'WorkflowExecution');
        });
        registerPendingClear(nodeId, terminalId);
      }
    }, CLEAR_TIMEOUT_MS);

    pendingClears.set(nodeId, { terminalId, attempts, timer });
  }

  function failClearRetryCap(nodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    const nodeName = node?.content || nodeId;

    clearPending(nodeId);
    stopWorkflow(nodeId);

    useToastStore.getState().addToast(
      `Workflow step "${nodeName}" could not clear the AI session after ${CLEAR_RETRY_CAP} attempts. Check that Claude is running in the target terminal.`,
      'error',
    );
    void notifyWorkflowEvent('alert', 'Clear AI session failed', `"${nodeName}" could not clear the AI session`);
  }

  function shouldClearBeforeSend(nodeId: string): boolean {
    const { nodes, ancestorRegistry, workflowExecutionStates } = get();
    const position = getWorkflowStepPosition(nodeId, nodes, ancestorRegistry);
    if (!position) return false;
    const stepNode = nodes[position.currentStepId];
    if (stepNode?.metadata.clearSession !== true) return false;
    const entry = workflowExecutionStates[nodeId];
    if (entry?.clearing) return false;
    return true;
  }

  function maybeClearThenSend(nodeId: string, terminalId: string): void {
    if (!shouldClearBeforeSend(nodeId)) {
      sendPrompt(nodeId, terminalId);
      return;
    }

    const { workflowExecutionStates } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry) return;

    set({
      workflowExecutionStates: {
        ...workflowExecutionStates,
        [nodeId]: { ...entry, clearing: true },
      },
    });

    writeClearToTerminal(terminalId).catch((error) => {
      logger.error('Failed to write /clear', error as Error, 'WorkflowExecution');
      clearPending(nodeId);
      stopWorkflow(nodeId);
      useToastStore.getState().addToast('Failed to clear AI session — workflow stopped', 'error');
    });
    registerPendingClear(nodeId, terminalId);
  }

  function onClearConfirmed(nodeId: string): void {
    const pending = pendingClears.get(nodeId);
    if (!pending) return;
    clearPending(nodeId);

    const { workflowExecutionStates } = get();
    const entry = workflowExecutionStates[nodeId];
    if (!entry || entry.state !== 'running') return;

    const updatedEntry: WorkflowExecutionEntry = { ...entry };
    delete updatedEntry.clearing;
    set({
      workflowExecutionStates: {
        ...workflowExecutionStates,
        [nodeId]: updatedEntry,
      },
    });

    // Small cushion so Claude's input handler has finished re-initialising
    // before the bracketed-paste prompt arrives.
    setTimeout(() => sendPrompt(nodeId, pending.terminalId), POST_CLEAR_SEND_DELAY_MS);
  }

  return {
    maybeClearThenSend,
    onClearConfirmed,
    clearPending,
    clearAllPending,
  };
}
