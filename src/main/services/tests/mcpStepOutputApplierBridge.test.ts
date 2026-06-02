import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// PR6 — IPC bridge for submit_step_output. Mirrors mcpTreeMutatorBridge: main
// sends an apply request to renderer, renderer applies content to the bound
// node and replies on a paired channel keyed by requestId. The factory exposes
// the same shape as the tree-mutator bridge (sendToRenderer, onRendererResponse,
// timeoutMs, dispose) so it slots into ArborescentMcpServer the same way.
import {
  createMcpStepOutputApplierBridge,
  McpStepOutputApplierBridge,
  StepOutputApplyRequest,
  StepOutputApplyResponse,
  STEP_OUTPUT_APPLY_REQUEST_CHANNEL,
} from '../mcpStepOutputApplierBridge';

const NODE_A = 'node-a';
const SESSION = 'sess-1';

function makeFakeResponseChannel() {
  const handlers = new Set<(response: StepOutputApplyResponse) => void>();
  return {
    onResponse: (handler: (response: StepOutputApplyResponse) => void) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    emit: (response: StepOutputApplyResponse) => {
      for (const handler of handlers) handler(response);
    },
  };
}

describe('createMcpStepOutputApplierBridge — request/reply', () => {
  let sendToRenderer: ReturnType<typeof vi.fn>;
  let channel: ReturnType<typeof makeFakeResponseChannel>;
  let bridge: McpStepOutputApplierBridge;

  beforeEach(() => {
    vi.useFakeTimers();
    sendToRenderer = vi.fn();
    channel = makeFakeResponseChannel();
    bridge = createMcpStepOutputApplierBridge({
      sendToRenderer,
      onRendererResponse: channel.onResponse,
      timeoutMs: 5000,
    });
  });

  afterEach(() => {
    bridge.dispose();
    vi.useRealTimers();
  });

  it('sends an apply request with a unique requestId, bound nodeId, and content', async () => {
    const promise = bridge.apply(SESSION, NODE_A, 'Claude response');
    expect(sendToRenderer).toHaveBeenCalledTimes(1);
    const [channelName, payload] = sendToRenderer.mock.calls[0] as [string, StepOutputApplyRequest];
    expect(channelName).toBe(STEP_OUTPUT_APPLY_REQUEST_CHANNEL);
    expect(payload.nodeId).toBe(NODE_A);
    expect(payload.sessionId).toBe(SESSION);
    expect(payload.content).toBe('Claude response');
    expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/);

    channel.emit({ requestId: payload.requestId, result: { ok: true } });
    await promise;
  });

  it('resolves with ok=true when renderer reports success', async () => {
    const promise = bridge.apply(SESSION, NODE_A, 'x');
    const [, payload] = sendToRenderer.mock.calls[0] as [string, StepOutputApplyRequest];
    channel.emit({ requestId: payload.requestId, result: { ok: true } });
    await expect(promise).resolves.toEqual({ ok: true });
  });

  it('resolves with the renderer error message when renderer reports failure', async () => {
    const promise = bridge.apply(SESSION, NODE_A, 'x');
    const [, payload] = sendToRenderer.mock.calls[0] as [string, StepOutputApplyRequest];
    channel.emit({ requestId: payload.requestId, result: { ok: false, error: 'no store for bound node' } });
    await expect(promise).resolves.toEqual({ ok: false, error: 'no store for bound node' });
  });

  it('ignores a response whose requestId does not match any pending apply', async () => {
    const promise = bridge.apply(SESSION, NODE_A, 'x');
    const [, payload] = sendToRenderer.mock.calls[0] as [string, StepOutputApplyRequest];
    channel.emit({ requestId: 'unrelated', result: { ok: true } });
    channel.emit({ requestId: payload.requestId, result: { ok: true } });
    await expect(promise).resolves.toEqual({ ok: true });
  });

  it('concurrent applies resolve independently by requestId', async () => {
    const p1 = bridge.apply(SESSION, 'node-1', 'a');
    const p2 = bridge.apply(SESSION, 'node-2', 'b');
    const id1 = (sendToRenderer.mock.calls[0][1] as StepOutputApplyRequest).requestId;
    const id2 = (sendToRenderer.mock.calls[1][1] as StepOutputApplyRequest).requestId;

    channel.emit({ requestId: id2, result: { ok: false, error: 'B failed' } });
    await expect(p2).resolves.toEqual({ ok: false, error: 'B failed' });

    channel.emit({ requestId: id1, result: { ok: true } });
    await expect(p1).resolves.toEqual({ ok: true });
  });

  it('returns an error when no response arrives within timeoutMs', async () => {
    const promise = bridge.apply(SESSION, NODE_A, 'x');
    vi.advanceTimersByTime(5000);
    await expect(promise).resolves.toEqual(
      expect.objectContaining({ ok: false, error: expect.stringMatching(/timed out/i) }),
    );
  });

  it('a late response after timeout is ignored without throwing', async () => {
    const promise = bridge.apply(SESSION, NODE_A, 'x');
    const [, payload] = sendToRenderer.mock.calls[0] as [string, StepOutputApplyRequest];
    vi.advanceTimersByTime(5000);
    await promise;
    expect(() => {
      channel.emit({ requestId: payload.requestId, result: { ok: true } });
    }).not.toThrow();
  });

  it('returns an error when bound nodeId is empty (defensive guard)', async () => {
    await expect(bridge.apply(SESSION, '', 'x')).resolves.toEqual(expect.objectContaining({ ok: false }));
    expect(sendToRenderer).not.toHaveBeenCalled();
  });
});

describe('createMcpStepOutputApplierBridge — dispose', () => {
  it('dispose resolves pending applies with an error and unsubscribes', async () => {
    vi.useFakeTimers();
    const sendToRenderer = vi.fn();
    const channel = makeFakeResponseChannel();
    const bridge = createMcpStepOutputApplierBridge({
      sendToRenderer,
      onRendererResponse: channel.onResponse,
      timeoutMs: 5000,
    });

    const pending = bridge.apply(SESSION, NODE_A, 'x');
    bridge.dispose();

    vi.advanceTimersByTime(100);
    await expect(pending).resolves.toEqual(
      expect.objectContaining({ ok: false, error: expect.stringMatching(/disposed/i) }),
    );
    vi.useRealTimers();
  });
});
