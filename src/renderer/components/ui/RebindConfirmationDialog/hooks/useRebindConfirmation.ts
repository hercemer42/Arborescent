import { useCallback, useEffect, useState } from 'react';
import type { RebindRequestEvent } from '../../../../../shared/types/electronApi';
import { storeManager } from '../../../../store/storeManager';
import { usePendingRebindDialogStore } from '../../../../store/pendingRebindDialogStore';
import { extractTaskTitle } from '../../../../utils/terminalTabTitle';

function shortenUuid(uuid: string): string {
  return uuid.length > 8 ? `${uuid.slice(0, 8)}…` : uuid;
}

export type RebindConfirmationState =
  | { pendingRequest: null }
  | {
      pendingRequest: RebindRequestEvent;
      previousLabel: string;
      newLabel: string;
      onConfirm: () => void;
      onCancel: () => void;
    };

function lookupNodeLabel(nodeId: string): string {
  for (const store of storeManager.getAllStores()) {
    const node = store.getState().nodes[nodeId];
    if (node) {
      return extractTaskTitle(node) || `Node ${shortenUuid(nodeId)}`;
    }
  }
  return `Node ${shortenUuid(nodeId)}`;
}

function markDialogPendingForSession(sessionId: string): void {
  for (const store of storeManager.getAllStores()) {
    const terminalId = store.getState().workflowSessionMap[sessionId];
    if (terminalId) {
      usePendingRebindDialogStore.getState().markPending(terminalId);
      return;
    }
  }
}

function clearDialogPendingForSession(sessionId: string): void {
  for (const store of storeManager.getAllStores()) {
    const terminalId = store.getState().workflowSessionMap[sessionId];
    if (terminalId) {
      usePendingRebindDialogStore.getState().clearPending(terminalId);
      return;
    }
  }
}

function clearOptimisticCollaboratingNode(nodeId: string): void {
  for (const store of storeManager.getAllStores()) {
    const state = store.getState();
    if (state.collaboratingNodeId === nodeId) {
      store.setState({
        collaboratingNodeId: null,
        collaborationSource: null,
        collaboratingTerminalId: null,
      });
    }
  }
}

export function useRebindConfirmation(): RebindConfirmationState {
  const [pendingRequest, setPendingRequest] = useState<RebindRequestEvent | null>(null);

  useEffect(() => {
    return window.electron.onRebindRequest((event) => {
      setPendingRequest(event);
      markDialogPendingForSession(event.sessionId);
    });
  }, []);

  useEffect(() => {
    return window.electron.onRebindCancelled((sessionId) => {
      clearDialogPendingForSession(sessionId);
      setPendingRequest((current) => {
        if (!current || current.sessionId !== sessionId) return current;
        clearOptimisticCollaboratingNode(current.newNodeId);
        return null;
      });
    });
  }, []);

  const onConfirm = useCallback(() => {
    if (!pendingRequest) return;
    void window.electron.respondToRebindRequest(pendingRequest.sessionId, true);
    clearDialogPendingForSession(pendingRequest.sessionId);
    setPendingRequest(null);
  }, [pendingRequest]);

  const onCancel = useCallback(() => {
    if (!pendingRequest) return;
    void window.electron.respondToRebindRequest(pendingRequest.sessionId, false);
    clearDialogPendingForSession(pendingRequest.sessionId);
    clearOptimisticCollaboratingNode(pendingRequest.newNodeId);
    setPendingRequest(null);
  }, [pendingRequest]);

  if (!pendingRequest) {
    return { pendingRequest: null };
  }

  return {
    pendingRequest,
    previousLabel: lookupNodeLabel(pendingRequest.previousNodeId),
    newLabel: lookupNodeLabel(pendingRequest.newNodeId),
    onConfirm,
    onCancel,
  };
}
