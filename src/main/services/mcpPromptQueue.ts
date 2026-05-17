import { logger } from './logger';

export type QueuedPrompt = {
  content: string;
  source: 'workflow' | 'manual';
};

type EnqueueListener = (sessionId: string, item: QueuedPrompt) => void;

export class PromptQueue {
  private queues = new Map<string, QueuedPrompt[]>();
  private listeners = new Set<EnqueueListener>();

  enqueue(sessionId: string, item: QueuedPrompt): void {
    if (!sessionId) return;
    const existing = this.queues.get(sessionId);
    if (existing) {
      existing.push(item);
    } else {
      this.queues.set(sessionId, [item]);
    }
    for (const listener of this.listeners) {
      try {
        listener(sessionId, item);
      } catch (error) {
        logger.error('PromptQueue enqueue listener threw', error as Error, 'PromptQueue');
      }
    }
  }

  peek(sessionId: string): QueuedPrompt | null {
    if (!sessionId) return null;
    const items = this.queues.get(sessionId);
    if (!items || items.length === 0) return null;
    return items[0];
  }

  drain(sessionId: string): QueuedPrompt | null {
    if (!sessionId) return null;
    const items = this.queues.get(sessionId);
    if (!items || items.length === 0) return null;
    const next = items.shift() ?? null;
    if (items.length === 0) this.queues.delete(sessionId);
    return next;
  }

  size(sessionId: string): number {
    if (!sessionId) return 0;
    return this.queues.get(sessionId)?.length ?? 0;
  }

  onEnqueue(listener: EnqueueListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  clearForSession(sessionId: string): void {
    if (!sessionId) return;
    this.queues.delete(sessionId);
  }

  clear(): void {
    this.queues.clear();
  }
}
