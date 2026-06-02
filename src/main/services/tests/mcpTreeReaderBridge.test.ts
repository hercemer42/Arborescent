import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  createMcpTreeReaderBridge,
  McpTreeReaderBridge,
  TreeReadRequest,
  TreeReadResponse,
  TREE_READ_REQUEST_CHANNEL,
} from '../mcpTreeReaderBridge';
import { TreeReadState } from '../mcpReadTools';

const NODE_A = 'node-a';
const SESSION = 'sess-1';

function makeState(): TreeReadState {
  return {
    nodes: {
      [NODE_A]: { id: NODE_A, content: 'A', children: [], metadata: {} },
    },
    rootNodeId: NODE_A,
    ancestorRegistry: { [NODE_A]: [] },
  };
}

function makeFakeResponseChannel(): {
  onResponse: (handler: (response: TreeReadResponse) => void) => () => void;
  emit: (response: TreeReadResponse) => void;
} {
  const handlers = new Set<(response: TreeReadResponse) => void>();
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

describe('createMcpTreeReaderBridge — request/reply', () => {
  let sendToRenderer: ReturnType<typeof vi.fn>;
  let channel: ReturnType<typeof makeFakeResponseChannel>;
  let bridge: McpTreeReaderBridge;

  beforeEach(() => {
    vi.useFakeTimers();
    sendToRenderer = vi.fn();
    channel = makeFakeResponseChannel();
    bridge = createMcpTreeReaderBridge({
      sendToRenderer,
      onRendererResponse: channel.onResponse,
      timeoutMs: 5000,
    });
  });

  afterEach(() => {
    bridge.dispose();
    vi.useRealTimers();
  });

  it('sends a request with a unique requestId, the session, and the bound nodeId', async () => {
    const promise = bridge.readState(SESSION, NODE_A);
    expect(sendToRenderer).toHaveBeenCalledTimes(1);
    const [channelName, payload] = sendToRenderer.mock.calls[0] as [string, TreeReadRequest];
    expect(channelName).toBe(TREE_READ_REQUEST_CHANNEL);
    expect(payload.nodeId).toBe(NODE_A);
    expect(payload.sessionId).toBe(SESSION);
    expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/);

    channel.emit({ requestId: payload.requestId, state: makeState() });
    await promise;
  });

  it('resolves with the state when a response with matching requestId arrives', async () => {
    const promise = bridge.readState(SESSION, NODE_A);
    const [, payload] = sendToRenderer.mock.calls[0] as [string, TreeReadRequest];

    const state = makeState();
    channel.emit({ requestId: payload.requestId, state });

    await expect(promise).resolves.toEqual(state);
  });

  it('resolves with null when the renderer returns null state', async () => {
    const promise = bridge.readState(SESSION, NODE_A);
    const [, payload] = sendToRenderer.mock.calls[0] as [string, TreeReadRequest];

    channel.emit({ requestId: payload.requestId, state: null });

    await expect(promise).resolves.toBeNull();
  });

  it('ignores a response whose requestId does not match a pending request', async () => {
    const promise = bridge.readState(SESSION, NODE_A);
    const [, payload] = sendToRenderer.mock.calls[0] as [string, TreeReadRequest];

    channel.emit({ requestId: 'unrelated-request-id', state: makeState() });
    channel.emit({ requestId: payload.requestId, state: makeState() });

    await expect(promise).resolves.not.toBeNull();
  });

  it('concurrent requests resolve independently by their requestId', async () => {
    const p1 = bridge.readState(SESSION, 'node-1');
    const p2 = bridge.readState(SESSION, 'node-2');

    expect(sendToRenderer).toHaveBeenCalledTimes(2);
    const id1 = (sendToRenderer.mock.calls[0][1] as TreeReadRequest).requestId;
    const id2 = (sendToRenderer.mock.calls[1][1] as TreeReadRequest).requestId;

    const state2 = makeState();
    channel.emit({ requestId: id2, state: state2 });
    await expect(p2).resolves.toEqual(state2);

    const state1 = makeState();
    channel.emit({ requestId: id1, state: state1 });
    await expect(p1).resolves.toEqual(state1);
  });

  it('returns null when no response arrives within timeoutMs', async () => {
    const promise = bridge.readState(SESSION, NODE_A);

    vi.advanceTimersByTime(5000);

    await expect(promise).resolves.toBeNull();
  });

  it('a late response after timeout is ignored without throwing', async () => {
    const promise = bridge.readState(SESSION, NODE_A);
    const [, payload] = sendToRenderer.mock.calls[0] as [string, TreeReadRequest];

    vi.advanceTimersByTime(5000);
    await expect(promise).resolves.toBeNull();

    expect(() => {
      channel.emit({ requestId: payload.requestId, state: makeState() });
    }).not.toThrow();
  });

  it('returns null immediately when the bound nodeId is an empty string', async () => {
    await expect(bridge.readState(SESSION, '')).resolves.toBeNull();
    expect(sendToRenderer).not.toHaveBeenCalled();
  });
});

describe('createMcpTreeReaderBridge — dispose', () => {
  it('dispose unsubscribes from the renderer response channel', async () => {
    vi.useFakeTimers();
    const sendToRenderer = vi.fn();
    const channel = makeFakeResponseChannel();
    const bridge = createMcpTreeReaderBridge({
      sendToRenderer,
      onRendererResponse: channel.onResponse,
      timeoutMs: 5000,
    });

    const pending = bridge.readState(SESSION, NODE_A);
    bridge.dispose();

    vi.advanceTimersByTime(100);
    await expect(pending).resolves.toBeNull();
    vi.useRealTimers();
  });
});
