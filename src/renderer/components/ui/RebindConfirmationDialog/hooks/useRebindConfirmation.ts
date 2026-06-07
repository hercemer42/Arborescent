import { useCallback, useEffect, useState } from 'react';
import type { RebindRequestEvent } from '../../../../../shared/types/electronApi';
import { storeManager } from '../../../../store/storeManager';
import { usePendingRebindDialogStore } from '../../../../store/pendingRebindDialogStore';
import {
  useRebindPreflightStore,
  type PreflightRebindRequest,
} from '../../../../store/rebindPreflightStore';
import { extractTaskTitle } from '../../../../utils/terminalTabTitle';
import { logger } from '../../../../services/logger';
import { isNodeInReview, removeReview } from '../../../../store/tree/reviews';

function shortenUuid(uuid: string): string {
  return uuid.length > 8 ? `${uuid.slice(0, 8)}…` : uuid;
}

export type RebindConfirmationState =
  | { pendingRequest: null }
  | {
      pendingRequest: 'session' | 'preflight';
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
    if (isNodeInReview(state.reviews, nodeId)) {
      store.setState({ reviews: removeReview(state.reviews, nodeId) });
    }
  }
}

export function useRebindConfirmation(): RebindConfirmationState {
  const [sessionRequest, setSessionRequest] = useState<RebindRequestEvent | null>(null);
  const preflightRequest = useRebindPreflightStore((s) => s.current);

  useEffect(() => {
    return window.electron.onRebindRequest((event) => {
      setSessionRequest(event);
      markDialogPendingForSession(event.sessionId);
    });
  }, []);

  useEffect(() => {
    return window.electron.onRebindCancelled((sessionId) => {
      clearDialogPendingForSession(sessionId);
      setSessionRequest((current) => {
        if (!current || current.sessionId !== sessionId) return current;
        clearOptimisticCollaboratingNode(current.newNodeId);
        return null;
      });
    });
  }, []);

  const onSessionConfirm = useCallback(() => {
    if (!sessionRequest) return;
    void window.electron.respondToRebindRequest(sessionRequest.sessionId, true);
    clearDialogPendingForSession(sessionRequest.sessionId);
    setSessionRequest(null);
  }, [sessionRequest]);

  const onSessionCancel = useCallback(() => {
    if (!sessionRequest) return;
    void window.electron.respondToRebindRequest(sessionRequest.sessionId, false);
    clearDialogPendingForSession(sessionRequest.sessionId);
    clearOptimisticCollaboratingNode(sessionRequest.newNodeId);
    setSessionRequest(null);
  }, [sessionRequest]);

  const onPreflightConfirm = useCallback(() => {
    const current = useRebindPreflightStore.getState().current;
    if (!current) return;
    finalizePreflight(current);
    void Promise.resolve(current.replay()).catch((error) => {
      logger.error('Failed to replay deferred send after rebind confirmation', error as Error, 'RebindPreflight');
    });
  }, []);

  const onPreflightCancel = useCallback(() => {
    const current = useRebindPreflightStore.getState().current;
    if (!current) return;
    finalizePreflight(current);
  }, []);

  if (sessionRequest) {
    return {
      pendingRequest: 'session',
      previousLabel: lookupNodeLabel(sessionRequest.previousNodeId),
      newLabel: lookupNodeLabel(sessionRequest.newNodeId),
      onConfirm: onSessionConfirm,
      onCancel: onSessionCancel,
    };
  }

  if (preflightRequest) {
    return {
      pendingRequest: 'preflight',
      previousLabel: lookupNodeLabel(preflightRequest.previousNodeId),
      newLabel: lookupNodeLabel(preflightRequest.newNodeId),
      onConfirm: onPreflightConfirm,
      onCancel: onPreflightCancel,
    };
  }

  return { pendingRequest: null };
}

function finalizePreflight(request: PreflightRebindRequest): void {
  usePendingRebindDialogStore.getState().clearPending(request.terminalId);
  useRebindPreflightStore.getState().clear();
}
