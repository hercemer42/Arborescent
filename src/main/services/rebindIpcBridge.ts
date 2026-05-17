import { logger } from './logger';
import { SessionBindingRegistry, RebindRequest } from './sessionBindingRegistry';
import { SubmitMarker } from './submitMarker';

export const REBIND_REQUEST_CHANNEL = 'mcp:rebind-request';
export const REBIND_CANCELLED_CHANNEL = 'mcp:rebind-cancelled';

export type RebindDecision = {
  sessionId: string;
  confirmed: boolean;
};

export type RebindDecisionListener = (decision: RebindDecision) => void;

export type RebindIpcBridgeDeps = {
  registry: SessionBindingRegistry;
  submitMarker?: SubmitMarker;
  sendToRenderer: (channel: string, payload: RebindRequest) => void;
  notifyRendererCancelled: (sessionId: string) => void;
  onRendererDecision: (listener: RebindDecisionListener) => () => void;
  timeoutMs: number;
};

export type RebindIpcBridge = {
  dispose: () => void;
};

export function createRebindIpcBridge(deps: RebindIpcBridgeDeps): RebindIpcBridge {
  const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>();

  function clearTimer(sessionId: string): void {
    const timer = pendingTimers.get(sessionId);
    if (timer !== undefined) {
      clearTimeout(timer);
      pendingTimers.delete(sessionId);
    }
  }

  function armTimer(sessionId: string): void {
    clearTimer(sessionId);
    const timer = setTimeout(() => {
      pendingTimers.delete(sessionId);
      const cancelled = deps.registry.cancelRebind(sessionId);
      if (cancelled) {
        deps.notifyRendererCancelled(sessionId);
        logger.warn(`rebind for session=${sessionId} timed out; defaulting to cancel`, 'RebindIpcBridge');
      }
    }, deps.timeoutMs);
    pendingTimers.set(sessionId, timer);
  }

  const unsubscribeRegistry = deps.registry.onRebindRequest((request) => {
    deps.sendToRenderer(REBIND_REQUEST_CHANNEL, request);
    armTimer(request.sessionId);
  });

  const unsubscribeDecisions = deps.onRendererDecision((decision) => {
    clearTimer(decision.sessionId);
    if (decision.confirmed) {
      const swapped = deps.registry.confirmRebind(decision.sessionId);
      // Binding just swapped to the new node — reset the submit dedupe marker
      // so the safety net can fire on the next turn against the new binding.
      // (HookEventDispatcher intentionally does NOT reset on 'rebind-needed'
      // because the binding has not yet swapped at that point.)
      if (swapped) deps.submitMarker?.reset(decision.sessionId);
    } else {
      deps.registry.cancelRebind(decision.sessionId);
    }
  });

  return {
    dispose(): void {
      unsubscribeRegistry();
      unsubscribeDecisions();
      for (const timer of pendingTimers.values()) {
        clearTimeout(timer);
      }
      pendingTimers.clear();
    },
  };
}
