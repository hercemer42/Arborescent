import type { TreeNode } from '../../../../shared/types';
import { useToastStore } from '../../toast/toastStore';
import { notifyWorkflowEvent } from '../../../services/workflowNotification';

const ACK_TIMEOUT_MS = 5000;
const ACK_RETRY_CAP = 3;

export interface AckRetryManager {
  clearPendingAck(nodeId: string): void;
  consumePendingAck(nodeId: string): void;
  registerPendingAck(nodeId: string, terminalId: string): void;
  clearAll(): void;
}

export interface AckRetryManagerDeps {
  get: () => { nodes: Record<string, TreeNode> };
  sendContentToTerminal: (nodeId: string, terminalId: string) => void;
  stopWorkflow: (nodeId: string) => void;
}

// Per-instance UserPromptSubmit ack lifecycle: register a retry timer when a
// prompt is sent, consume it when the ack arrives, stop the workflow at the
// retry cap. Must be instantiated inside createWorkflowExecutionActions — the
// maps are per-actions-instance, and hoisting them to module scope would leak
// ack state across stores and tests.
export function createAckRetryManager(deps: AckRetryManagerDeps): AckRetryManager {
  const { get, sendContentToTerminal, stopWorkflow } = deps;
  const pendingAcks = new Map<string, { terminalId: string; attempts: number; timer: ReturnType<typeof setTimeout> }>();
  // ACKs that arrived before their pending entry was registered (the
  // autonomousCollaborate promise had not yet resolved). Prevents the
  // late-registered timer from firing a spurious retry.
  const preconsumedAcks = new Set<string>();

  function clearPendingAck(nodeId: string): void {
    const entry = pendingAcks.get(nodeId);
    if (entry) {
      clearTimeout(entry.timer);
      pendingAcks.delete(nodeId);
    }
    preconsumedAcks.delete(nodeId);
  }

  function consumePendingAck(nodeId: string): void {
    const entry = pendingAcks.get(nodeId);
    if (entry) {
      clearTimeout(entry.timer);
      pendingAcks.delete(nodeId);
      return;
    }
    preconsumedAcks.add(nodeId);
  }

  function registerPendingAck(nodeId: string, terminalId: string): void {
    if (preconsumedAcks.has(nodeId)) {
      preconsumedAcks.delete(nodeId);
      return;
    }

    const existing = pendingAcks.get(nodeId);
    if (existing) clearTimeout(existing.timer);
    const attempts = existing ? existing.attempts + 1 : 1;

    const timer = setTimeout(() => {
      if (attempts >= ACK_RETRY_CAP) {
        failAckRetryCap(nodeId);
      } else {
        sendContentToTerminal(nodeId, terminalId);
      }
    }, ACK_TIMEOUT_MS);

    pendingAcks.set(nodeId, { terminalId, attempts, timer });
  }

  function failAckRetryCap(nodeId: string): void {
    const { nodes } = get();
    const node = nodes[nodeId];
    const nodeName = node?.content || nodeId;

    // Clear before stopping: stopWorkflow calls back into clearPendingAck, and
    // the prior clear makes that re-entrant call a safe no-op.
    clearPendingAck(nodeId);
    stopWorkflow(nodeId);

    useToastStore.getState().addToast(
      `Workflow step "${nodeName}" could not be delivered after ${ACK_RETRY_CAP} attempts. Check that UserPromptSubmit is configured in ~/.claude/settings.json.`,
      'error',
    );
    void notifyWorkflowEvent('alert', 'Workflow delivery failed', `"${nodeName}" could not be delivered`);
  }

  function clearAll(): void {
    for (const nodeId of Array.from(pendingAcks.keys())) {
      clearPendingAck(nodeId);
    }
    preconsumedAcks.clear();
  }

  return {
    clearPendingAck,
    consumePendingAck,
    registerPendingAck,
    clearAll,
  };
}
