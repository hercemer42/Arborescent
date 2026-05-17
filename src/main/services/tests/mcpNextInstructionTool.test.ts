import { describe, it, expect, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import { PromptQueue } from '../mcpPromptQueue';
import { createNextInstructionTool, NextInstructionTool } from '../mcpNextInstructionTool';

const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';

function makeDeps() {
  const registry = new SessionBindingRegistry();
  const queue = new PromptQueue();
  return {
    registry,
    queue,
    deps: { bindingRegistry: registry, queue },
  };
}

function parseOk(result: { content: { text: string }[]; isError?: boolean }) {
  expect(result.isError ?? false).toBe(false);
  return JSON.parse(result.content[0].text);
}

describe('createNextInstructionTool — bound session with queued prompts', () => {
  let tool: NextInstructionTool;
  let queue: PromptQueue;

  function setup() {
    const made = makeDeps();
    made.registry.register('sess-1', BOUND);
    tool = createNextInstructionTool(made.deps);
    queue = made.queue;
  }

  it('returns the next queued prompt content and removes it from the queue', async () => {
    setup();
    queue.enqueue('sess-1', { content: 'first prompt', source: 'workflow' });
    queue.enqueue('sess-1', { content: 'second prompt', source: 'workflow' });
    const first = parseOk(await tool.nextInstruction({ sessionId: 'sess-1' }));
    expect(first).toMatchObject({ hasInstruction: true, content: 'first prompt' });
    expect(queue.size('sess-1')).toBe(1);
    const second = parseOk(await tool.nextInstruction({ sessionId: 'sess-1' }));
    expect(second).toMatchObject({ hasInstruction: true, content: 'second prompt' });
    expect(queue.size('sess-1')).toBe(0);
  });

  it('returns hasInstruction=false when the queue is empty (not an error)', async () => {
    setup();
    const payload = parseOk(await tool.nextInstruction({ sessionId: 'sess-1' }));
    expect(payload).toEqual({ hasInstruction: false });
  });

  it('reports an empty-content prompt as hasInstruction=true with empty content (caller-visible)', async () => {
    setup();
    queue.enqueue('sess-1', { content: '', source: 'workflow' });
    const payload = parseOk(await tool.nextInstruction({ sessionId: 'sess-1' }));
    expect(payload).toEqual({ hasInstruction: true, content: '' });
  });

  it('two calls drain in order; the third gets hasInstruction=false', async () => {
    setup();
    queue.enqueue('sess-1', { content: 'A', source: 'workflow' });
    queue.enqueue('sess-1', { content: 'B', source: 'workflow' });
    expect(parseOk(await tool.nextInstruction({ sessionId: 'sess-1' })).content).toBe('A');
    expect(parseOk(await tool.nextInstruction({ sessionId: 'sess-1' })).content).toBe('B');
    expect(parseOk(await tool.nextInstruction({ sessionId: 'sess-1' }))).toEqual({ hasInstruction: false });
  });
});

describe('createNextInstructionTool — unbound session', () => {
  it('returns hasInstruction=false rather than erroring (Claude may have stale state)', async () => {
    const made = makeDeps();
    const tool = createNextInstructionTool(made.deps);
    const payload = parseOk(await tool.nextInstruction({ sessionId: 'unknown-sess' }));
    expect(payload).toEqual({ hasInstruction: false });
  });

  it('does not drain a session whose queue exists from a prior binding', async () => {
    const made = makeDeps();
    made.queue.enqueue('sess-orphan', { content: 'leftover', source: 'workflow' });
    const tool = createNextInstructionTool(made.deps);
    const payload = parseOk(await tool.nextInstruction({ sessionId: 'sess-orphan' }));
    expect(payload).toEqual({ hasInstruction: false });
    // Item is preserved so the right session can pick it up after re-binding.
    expect(made.queue.size('sess-orphan')).toBe(1);
  });
});

describe('createNextInstructionTool — per-session isolation', () => {
  it('one session draining does not affect another session\'s queue', async () => {
    const made = makeDeps();
    made.registry.register('sess-A', BOUND);
    made.registry.register('sess-B', BOUND);
    made.queue.enqueue('sess-A', { content: 'for-A', source: 'workflow' });
    made.queue.enqueue('sess-B', { content: 'for-B', source: 'workflow' });
    const tool = createNextInstructionTool(made.deps);
    const a = parseOk(await tool.nextInstruction({ sessionId: 'sess-A' }));
    expect(a.content).toBe('for-A');
    expect(made.queue.size('sess-B')).toBe(1);
    const b = parseOk(await tool.nextInstruction({ sessionId: 'sess-B' }));
    expect(b.content).toBe('for-B');
  });
});
