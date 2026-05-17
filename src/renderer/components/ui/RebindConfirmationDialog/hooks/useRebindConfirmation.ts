import { useCallback, useEffect, useState } from 'react';
import type { RebindRequestEvent } from '../../../../../shared/types/electronApi';
import { storeManager } from '../../../../store/storeManager';
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

export function useRebindConfirmation(): RebindConfirmationState {
  const [pendingRequest, setPendingRequest] = useState<RebindRequestEvent | null>(null);

  useEffect(() => {
    return window.electron.onRebindRequest((event) => {
      setPendingRequest(event);
    });
  }, []);

  useEffect(() => {
    return window.electron.onRebindCancelled((sessionId) => {
      setPendingRequest((current) => (current && current.sessionId === sessionId ? null : current));
    });
  }, []);

  const onConfirm = useCallback(() => {
    if (!pendingRequest) return;
    void window.electron.respondToRebindRequest(pendingRequest.sessionId, true);
    setPendingRequest(null);
  }, [pendingRequest]);

  const onCancel = useCallback(() => {
    if (!pendingRequest) return;
    void window.electron.respondToRebindRequest(pendingRequest.sessionId, false);
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
