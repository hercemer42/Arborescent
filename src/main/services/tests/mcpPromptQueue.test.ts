import { describe, it, expect, vi } from 'vitest';

import { PromptQueue, QueuedPrompt } from '../mcpPromptQueue';

function sample(content: string, overrides: Partial<QueuedPrompt> = {}): QueuedPrompt {
  return { content, source: 'workflow', ...overrides };
}

describe('PromptQueue — enqueue / peek / drain semantics', () => {
  it('a fresh queue is empty — peek and drain both return null', () => {
    const queue = new PromptQueue();
    expect(queue.peek('sess-1')).toBeNull();
    expect(queue.drain('sess-1')).toBeNull();
  });

  it('enqueue adds an entry; peek returns it without removing it', () => {
    const queue = new PromptQueue();
    const item = sample('hello');
    queue.enqueue('sess-1', item);
    expect(queue.peek('sess-1')).toEqual(item);
    expect(queue.peek('sess-1')).toEqual(item);
  });

  it('drain returns the first entry and removes it', () => {
    const queue = new PromptQueue();
    queue.enqueue('sess-1', sample('first'));
    queue.enqueue('sess-1', sample('second'));
    expect(queue.drain('sess-1')?.content).toBe('first');
    expect(queue.drain('sess-1')?.content).toBe('second');
    expect(queue.drain('sess-1')).toBeNull();
  });

  it('size reports the per-session queue depth and falls to 0 after drain', () => {
    const queue = new PromptQueue();
    expect(queue.size('sess-1')).toBe(0);
    queue.enqueue('sess-1', sample('a'));
    queue.enqueue('sess-1', sample('b'));
    expect(queue.size('sess-1')).toBe(2);
    queue.drain('sess-1');
    expect(queue.size('sess-1')).toBe(1);
    queue.drain('sess-1');
    expect(queue.size('sess-1')).toBe(0);
  });

  it('enqueue order is preserved across many entries (FIFO)', () => {
    const queue = new PromptQueue();
    for (let i = 0; i < 10; i++) queue.enqueue('sess-1', sample(`p-${i}`));
    for (let i = 0; i < 10; i++) {
      expect(queue.drain('sess-1')?.content).toBe(`p-${i}`);
    }
  });
});

describe('PromptQueue — per-session isolation', () => {
  it('enqueue to one session does not appear in another', () => {
    const queue = new PromptQueue();
    queue.enqueue('sess-A', sample('for-A'));
    expect(queue.peek('sess-B')).toBeNull();
    expect(queue.drain('sess-B')).toBeNull();
    expect(queue.size('sess-B')).toBe(0);
    expect(queue.drain('sess-A')?.content).toBe('for-A');
  });

  it('many sessions remain independent under concurrent-style operations', () => {
    const queue = new PromptQueue();
    for (let i = 0; i < 20; i++) queue.enqueue(`sess-${i}`, sample(`p-${i}`));
    for (let i = 0; i < 20; i++) {
      expect(queue.peek(`sess-${i}`)?.content).toBe(`p-${i}`);
    }
    for (let i = 0; i < 20; i++) {
      expect(queue.drain(`sess-${i}`)?.content).toBe(`p-${i}`);
    }
    for (let i = 0; i < 20; i++) {
      expect(queue.size(`sess-${i}`)).toBe(0);
    }
  });
});

describe('PromptQueue — listeners', () => {
  it('onEnqueue listeners receive the session_id and the queued item', () => {
    const queue = new PromptQueue();
    const listener = vi.fn();
    queue.onEnqueue(listener);
    const item = sample('triggered');
    queue.enqueue('sess-1', item);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith('sess-1', item);
  });

  it('onEnqueue returns an unsubscribe function', () => {
    const queue = new PromptQueue();
    const listener = vi.fn();
    const off = queue.onEnqueue(listener);
    off();
    queue.enqueue('sess-1', sample('x'));
    expect(listener).not.toHaveBeenCalled();
  });

  it('a listener that throws does not prevent other listeners from firing or the enqueue from completing', () => {
    const queue = new PromptQueue();
    const goodA = vi.fn();
    const bad = vi.fn(() => {
      throw new Error('listener boom');
    });
    const goodB = vi.fn();
    queue.onEnqueue(goodA);
    queue.onEnqueue(bad);
    queue.onEnqueue(goodB);
    expect(() => queue.enqueue('sess-1', sample('x'))).not.toThrow();
    expect(goodA).toHaveBeenCalled();
    expect(goodB).toHaveBeenCalled();
    expect(queue.peek('sess-1')?.content).toBe('x');
  });

  it('drain does NOT fire onEnqueue listeners', () => {
    const queue = new PromptQueue();
    const listener = vi.fn();
    queue.enqueue('sess-1', sample('x'));
    queue.onEnqueue(listener);
    queue.drain('sess-1');
    expect(listener).not.toHaveBeenCalled();
  });
});

describe('PromptQueue — clear', () => {
  it('clearForSession removes only that session', () => {
    const queue = new PromptQueue();
    queue.enqueue('sess-A', sample('a'));
    queue.enqueue('sess-B', sample('b'));
    queue.clearForSession('sess-A');
    expect(queue.size('sess-A')).toBe(0);
    expect(queue.size('sess-B')).toBe(1);
  });

  it('clear removes all sessions (used on MCP server stop)', () => {
    const queue = new PromptQueue();
    queue.enqueue('sess-A', sample('a'));
    queue.enqueue('sess-B', sample('b'));
    queue.clear();
    expect(queue.size('sess-A')).toBe(0);
    expect(queue.size('sess-B')).toBe(0);
  });
});

describe('PromptQueue — boundary inputs', () => {
  it('empty session id is rejected (does not silently enqueue under "")', () => {
    const queue = new PromptQueue();
    queue.enqueue('', sample('x'));
    expect(queue.size('')).toBe(0);
    expect(queue.peek('')).toBeNull();
  });

  it('drain on never-touched session returns null without throwing', () => {
    const queue = new PromptQueue();
    expect(() => queue.drain('never')).not.toThrow();
    expect(queue.drain('never')).toBeNull();
  });
});
