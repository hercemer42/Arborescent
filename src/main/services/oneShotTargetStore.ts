export class OneShotTargetStore {
  private pendingTargets = new Map<string, string>();
  private markerSeen = new Set<string>();

  setPendingTarget(sessionId: string, nodeId: string): void {
    if (!sessionId || !nodeId) return;
    this.pendingTargets.set(sessionId, nodeId);
  }

  clearPendingTarget(sessionId: string): void {
    if (!sessionId) return;
    this.pendingTargets.delete(sessionId);
  }

  pendingTarget(sessionId: string): string | null {
    if (!sessionId) return null;
    return this.pendingTargets.get(sessionId) ?? null;
  }

  setMarkerSeenThisTurn(sessionId: string, value: boolean): void {
    if (!sessionId) return;
    if (value) {
      this.markerSeen.add(sessionId);
    } else {
      this.markerSeen.delete(sessionId);
    }
  }

  wasMarkerSeenThisTurn(sessionId: string): boolean {
    if (!sessionId) return false;
    return this.markerSeen.has(sessionId);
  }

  resetSession(sessionId: string): void {
    if (!sessionId) return;
    this.pendingTargets.delete(sessionId);
    this.markerSeen.delete(sessionId);
  }

  clear(): void {
    this.pendingTargets.clear();
    this.markerSeen.clear();
  }
}
