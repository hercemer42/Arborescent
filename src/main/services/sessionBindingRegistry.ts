export type RegisterResult =
  | { kind: 'set'; sessionId: string; nodeId: string }
  | { kind: 'no-op'; sessionId: string; nodeId: string }
  | { kind: 'rebind-needed'; sessionId: string; previousNodeId: string; newNodeId: string };

export type RebindRequest = {
  sessionId: string;
  previousNodeId: string;
  newNodeId: string;
};

type RebindListener = (request: RebindRequest) => void;

export class SessionBindingRegistry {
  private bindings = new Map<string, string>();
  private pendingRebinds = new Map<string, string>();
  private rebindListeners = new Set<RebindListener>();

  register(sessionId: string, nodeId: string): RegisterResult | null {
    if (!sessionId || !nodeId) {
      return null;
    }

    const existing = this.bindings.get(sessionId);

    if (existing === undefined) {
      this.bindings.set(sessionId, nodeId);
      return { kind: 'set', sessionId, nodeId };
    }

    if (existing === nodeId) {
      this.pendingRebinds.delete(sessionId);
      return { kind: 'no-op', sessionId, nodeId };
    }

    const previousPending = this.pendingRebinds.get(sessionId);
    this.pendingRebinds.set(sessionId, nodeId);

    if (previousPending !== nodeId) {
      this.emitRebindRequest({ sessionId, previousNodeId: existing, newNodeId: nodeId });
    }

    return {
      kind: 'rebind-needed',
      sessionId,
      previousNodeId: existing,
      newNodeId: nodeId,
    };
  }

  confirmRebind(sessionId: string): boolean {
    const pending = this.pendingRebinds.get(sessionId);
    if (pending === undefined) return false;
    this.bindings.set(sessionId, pending);
    this.pendingRebinds.delete(sessionId);
    return true;
  }

  cancelRebind(sessionId: string): boolean {
    return this.pendingRebinds.delete(sessionId);
  }

  lookup(sessionId: string): string | null {
    if (!sessionId) return null;
    return this.bindings.get(sessionId) ?? null;
  }

  pendingRebind(sessionId: string): string | null {
    return this.pendingRebinds.get(sessionId) ?? null;
  }

  onRebindRequest(listener: RebindListener): () => void {
    this.rebindListeners.add(listener);
    return () => this.rebindListeners.delete(listener);
  }

  clear(): void {
    this.bindings.clear();
    this.pendingRebinds.clear();
  }

  unregister(sessionId: string): boolean {
    if (!sessionId) return false;
    const hadBinding = this.bindings.delete(sessionId);
    const hadPending = this.pendingRebinds.delete(sessionId);
    return hadBinding || hadPending;
  }

  private emitRebindRequest(request: RebindRequest): void {
    for (const listener of this.rebindListeners) {
      listener(request);
    }
  }
}
