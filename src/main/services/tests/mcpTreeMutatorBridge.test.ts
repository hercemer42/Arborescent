import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  createMcpTreeMutatorBridge,
  McpTreeMutatorBridge,
  TreeMutateRequest,
  TreeMutateResponse,
  TREE_MUTATE_REQUEST_CHANNEL,
} from '../mcpTreeMutatorBridge';
import { MutationRequest } from '../mcpWriteTools';

const NODE_A = 'node-a';
const ADD_CHILD: MutationRequest = { kind: 'add-child', parentId: NODE_A, content: 'new' };
const SESSION = 'sess-1';

function makeFakeResponseChannel(): {
  onResponse: (handler: (response: TreeMutateResponse) => void) => () => void;
  emit: (response: TreeMutateResponse) => void;
} {
  const handlers = new Set<(response: TreeMutateResponse) => void>();
  return {
    onResponse: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    emit: (response) => {
      for (const handler of handlers) handler(response);
    },
  };
}

describe('createMcpTreeMutatorBridge — request/reply', () => {
  let sendToRenderer: ReturnType<typeof vi.fn>;
  let channel: ReturnType<typeof makeFakeResponseChannel>;
  let bridge: McpTreeMutatorBridge;

  beforeEach(() => {
    vi.useFakeTimers();
    sendToRenderer = vi.fn();
    channel = makeFakeResponseChannel();
    bridge = createMcpTreeMutatorBridge({
      sendToRenderer,
      onRendererResponse: channel.onResponse,
      timeoutMs: 5000,
    });
  });

  afterEach(() => {
    bridge.dispose();
    vi.useRealTimers();
  });

  it('sends a request with a unique requestId, the bound nodeId, and the mutation', async () => {
    const promise = bridge.mutate(SESSION, NODE_A, ADD_CHILD);
    expect(sendToRenderer).toHaveBeenCalledTimes(1);
    const [channelName, payload] = sendToRenderer.mock.calls[0] as [string, TreeMutateRequest];
    expect(channelName).toBe(TREE_MUTATE_REQUEST_CHANNEL);
    expect(payload.nodeId).toBe(NODE_A);
    expect(payload.sessionId).toBe(SESSION);
    expect(payload.request).toEqual(ADD_CHILD);
    expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/);

    channel.emit({ requestId: payload.requestId, result: { ok: true } });
    await promise;
  });

  it('resolves with the ok result when a matching response arrives', async () => {
    const promise = bridge.mutate(SESSION, NODE_A, ADD_CHILD);
    const [, payload] = sendToRenderer.mock.calls[0] as [string, TreeMutateRequest];

    channel.emit({ requestId: payload.requestId, result: { ok: true } });

    await expect(promise).resolves.toEqual({ ok: true });
  });

  it('resolves with the error result when the renderer returns ok=false', async () => {
    const promise = bridge.mutate(SESSION, NODE_A, ADD_CHILD);
    const [, payload] = sendToRenderer.mock.calls[0] as [string, TreeMutateRequest];

    channel.emit({ requestId: payload.requestId, result: { ok: false, error: 'parent missing' } });

    await expect(promise).resolves.toEqual({ ok: false, error: 'parent missing' });
  });

  it('ignores a response whose requestId does not match a pending request', async () => {
    const promise = bridge.mutate(SESSION, NODE_A, ADD_CHILD);
    const [, payload] = sendToRenderer.mock.calls[0] as [string, TreeMutateRequest];

    channel.emit({ requestId: 'unrelated', result: { ok: true } });
    channel.emit({ requestId: payload.requestId, result: { ok: true } });

    await expect(promise).resolves.toEqual({ ok: true });
  });

  it('concurrent mutations resolve independently by requestId', async () => {
    const p1 = bridge.mutate(SESSION, 'node-1', ADD_CHILD);
    const p2 = bridge.mutate(SESSION, 'node-2', ADD_CHILD);
    const id1 = (sendToRenderer.mock.calls[0][1] as TreeMutateRequest).requestId;
    const id2 = (sendToRenderer.mock.calls[1][1] as TreeMutateRequest).requestId;

    channel.emit({ requestId: id2, result: { ok: false, error: 'B failed' } });
    await expect(p2).resolves.toEqual({ ok: false, error: 'B failed' });

    channel.emit({ requestId: id1, result: { ok: true } });
    await expect(p1).resolves.toEqual({ ok: true });
  });

  it('returns an error result when no response arrives within timeoutMs', async () => {
    const promise = bridge.mutate(SESSION, NODE_A, ADD_CHILD);

    vi.advanceTimersByTime(5000);

    await expect(promise).resolves.toEqual(
      expect.objectContaining({ ok: false, error: expect.stringMatching(/timed out/i) }),
    );
  });

  it('a late response after timeout is ignored without throwing', async () => {
    const promise = bridge.mutate(SESSION, NODE_A, ADD_CHILD);
    const [, payload] = sendToRenderer.mock.calls[0] as [string, TreeMutateRequest];

    vi.advanceTimersByTime(5000);
    await promise;

    expect(() => {
      channel.emit({ requestId: payload.requestId, result: { ok: true } });
    }).not.toThrow();
  });

  it('returns an error result when the bound nodeId is an empty string', async () => {
    await expect(bridge.mutate(SESSION, '', ADD_CHILD)).resolves.toEqual(
      expect.objectContaining({ ok: false }),
    );
    expect(sendToRenderer).not.toHaveBeenCalled();
  });
});

describe('createMcpTreeMutatorBridge — dispose', () => {
  it('dispose resolves pending mutations with an error and unsubscribes', async () => {
    vi.useFakeTimers();
    const sendToRenderer = vi.fn();
    const channel = makeFakeResponseChannel();
    const bridge = createMcpTreeMutatorBridge({
      sendToRenderer,
      onRendererResponse: channel.onResponse,
      timeoutMs: 5000,
    });

    const pending = bridge.mutate(SESSION, NODE_A, ADD_CHILD);
    bridge.dispose();

    vi.advanceTimersByTime(100);
    await expect(pending).resolves.toEqual(
      expect.objectContaining({ ok: false, error: expect.stringMatching(/disposed/i) }),
    );
    vi.useRealTimers();
  });
});
