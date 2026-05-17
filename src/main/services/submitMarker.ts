export class SubmitMarker {
  private marked = new Set<string>();

  markSubmitted(sessionId: string): void {
    if (!sessionId) return;
    this.marked.add(sessionId);
  }

  hasSubmitted(sessionId: string): boolean {
    if (!sessionId) return false;
    return this.marked.has(sessionId);
  }

  reset(sessionId: string): void {
    if (!sessionId) return;
    this.marked.delete(sessionId);
  }

  clear(): void {
    this.marked.clear();
  }
}
