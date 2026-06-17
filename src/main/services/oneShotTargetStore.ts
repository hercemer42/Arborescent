export class OneShotTargetStore {
  private pendingTargets = new Map<string, string>();
  private markerSeen = new Set<string>();
  private doneDeclarations = new Map<string, string>();

  setPendingTarget(sessionId: string, nodeId: string): void {
    if (!sessionId || !nodeId) return;
    this.pendingTargets.set(sessionId, nodeId);
  }

  clearPendingTarget(sessionId: string): void {
    if (!sessionId) return;
    this.pendingTargets.delete(sessionId);
  }

  markManualCollabResolved(sessionId: string): void {
    this.clearPendingTarget(sessionId);
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

  recordDoneDeclaration(sessionId: string, nodeId: string): void {
    if (!sessionId || !nodeId) return;
    this.doneDeclarations.set(sessionId, nodeId);
  }

  clearDoneDeclaration(sessionId: string): void {
    if (!sessionId) return;
    this.doneDeclarations.delete(sessionId);
  }

  doneDeclarationNode(sessionId: string): string | null {
    if (!sessionId) return null;
    return this.doneDeclarations.get(sessionId) ?? null;
  }

  resetSession(sessionId: string): void {
    if (!sessionId) return;
    this.pendingTargets.delete(sessionId);
    this.markerSeen.delete(sessionId);
    this.doneDeclarations.delete(sessionId);
  }

  clear(): void {
    this.pendingTargets.clear();
    this.markerSeen.clear();
    this.doneDeclarations.clear();
  }
}
