import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// PR7 — IPC bridge for proposal submission. Mirrors mcpStepOutputApplierBridge:
// main sends a proposal request to the renderer, renderer appends to the
// proposals store and replies on a paired channel keyed by requestId with an
// assigned proposalId. The factory exposes the same shape as the other MCP
// bridges (sendToRenderer, onRendererResponse, timeoutMs, dispose).
import {
  createMcpProposalBridge,
  McpProposalBridge,
  ProposalRequest,
  ProposalResponse,
  PROPOSAL_REQUEST_CHANNEL,
} from '../mcpProposalBridge';
import type { MutationRequest } from '../mcpWriteTools';

const SESSION_ID = 'sess-1';
const NODE_A = 'node-a';
const ADD_CHILD: MutationRequest = { kind: 'add-child', parentId: NODE_A, content: 'new' };

function makeFakeResponseChannel() {
  const handlers = new Set<(response: ProposalResponse) => void>();
  return {
    onResponse: (handler: (response: ProposalResponse) => void) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    emit: (response: ProposalResponse) => {
      for (const handler of handlers) handler(response);
    },
  };
}

describe('createMcpProposalBridge — request/reply', () => {
  let sendToRenderer: ReturnType<typeof vi.fn>;
  let channel: ReturnType<typeof makeFakeResponseChannel>;
  let bridge: McpProposalBridge;

  beforeEach(() => {
    vi.useFakeTimers();
    sendToRenderer = vi.fn();
    channel = makeFakeResponseChannel();
    bridge = createMcpProposalBridge({
      sendToRenderer,
      onRendererResponse: channel.onResponse,
      timeoutMs: 5000,
    });
  });

  afterEach(() => {
    bridge.dispose();
    vi.useRealTimers();
  });

  it('sends a proposal with a unique requestId, sessionId, nodeId, and the wrapped MutationRequest', async () => {
    const promise = bridge.submit({ sessionId: SESSION_ID, nodeId: NODE_A, request: ADD_CHILD });
    expect(sendToRenderer).toHaveBeenCalledTimes(1);
    const [channelName, payload] = sendToRenderer.mock.calls[0] as [string, ProposalRequest];
    expect(channelName).toBe(PROPOSAL_REQUEST_CHANNEL);
    expect(payload.sessionId).toBe(SESSION_ID);
    expect(payload.nodeId).toBe(NODE_A);
    expect(payload.request).toEqual(ADD_CHILD);
    expect(payload.requestId).toMatch(/^[0-9a-f-]{36}$/);

    channel.emit({ requestId: payload.requestId, result: { ok: true, proposalId: 'prop-1' } });
    await promise;
  });

  it('forwards a submit-step-output proposal as { kind: "submit-step-output", content }', async () => {
    const promise = bridge.submit({
      sessionId: SESSION_ID,
      nodeId: NODE_A,
      request: { kind: 'submit-step-output', content: 'Claude response' },
    });
    const [, payload] = sendToRenderer.mock.calls[0] as [string, ProposalRequest];
    expect(payload.request).toEqual({ kind: 'submit-step-output', content: 'Claude response' });
    channel.emit({ requestId: payload.requestId, result: { ok: true, proposalId: 'prop-2' } });
    await promise;
  });

  it('resolves with the renderer-assigned proposalId on success', async () => {
    const promise = bridge.submit({ sessionId: SESSION_ID, nodeId: NODE_A, request: ADD_CHILD });
    const [, payload] = sendToRenderer.mock.calls[0] as [string, ProposalRequest];

    channel.emit({ requestId: payload.requestId, result: { ok: true, proposalId: 'prop-abc' } });

    await expect(promise).resolves.toEqual({ ok: true, proposalId: 'prop-abc' });
  });

  it('resolves with the renderer error when the renderer reports failure', async () => {
    const promise = bridge.submit({ sessionId: SESSION_ID, nodeId: NODE_A, request: ADD_CHILD });
    const [, payload] = sendToRenderer.mock.calls[0] as [string, ProposalRequest];

    channel.emit({
      requestId: payload.requestId,
      result: { ok: false, error: 'no store for bound file' },
    });

    await expect(promise).resolves.toEqual({ ok: false, error: 'no store for bound file' });
  });

  it('ignores a response whose requestId does not match a pending submission', async () => {
    const promise = bridge.submit({ sessionId: SESSION_ID, nodeId: NODE_A, request: ADD_CHILD });
    const [, payload] = sendToRenderer.mock.calls[0] as [string, ProposalRequest];

    channel.emit({ requestId: 'unrelated', result: { ok: true, proposalId: 'wrong' } });
    channel.emit({ requestId: payload.requestId, result: { ok: true, proposalId: 'right' } });

    await expect(promise).resolves.toEqual({ ok: true, proposalId: 'right' });
  });

  it('concurrent submissions resolve independently by requestId', async () => {
    const p1 = bridge.submit({ sessionId: SESSION_ID, nodeId: 'node-1', request: ADD_CHILD });
    const p2 = bridge.submit({ sessionId: SESSION_ID, nodeId: 'node-2', request: ADD_CHILD });
    const id1 = (sendToRenderer.mock.calls[0][1] as ProposalRequest).requestId;
    const id2 = (sendToRenderer.mock.calls[1][1] as ProposalRequest).requestId;

    channel.emit({ requestId: id2, result: { ok: false, error: 'B failed' } });
    await expect(p2).resolves.toEqual({ ok: false, error: 'B failed' });

    channel.emit({ requestId: id1, result: { ok: true, proposalId: 'A-id' } });
    await expect(p1).resolves.toEqual({ ok: true, proposalId: 'A-id' });
  });

  it('returns an error when no response arrives within timeoutMs', async () => {
    const promise = bridge.submit({ sessionId: SESSION_ID, nodeId: NODE_A, request: ADD_CHILD });
    vi.advanceTimersByTime(5000);
    await expect(promise).resolves.toEqual(
      expect.objectContaining({ ok: false, error: expect.stringMatching(/timed out/i) }),
    );
  });

  it('a late response after timeout is ignored without throwing', async () => {
    const promise = bridge.submit({ sessionId: SESSION_ID, nodeId: NODE_A, request: ADD_CHILD });
    const [, payload] = sendToRenderer.mock.calls[0] as [string, ProposalRequest];
    vi.advanceTimersByTime(5000);
    await promise;
    expect(() => {
      channel.emit({ requestId: payload.requestId, result: { ok: true, proposalId: 'late' } });
    }).not.toThrow();
  });

  it('returns an error when sessionId is empty (defensive guard)', async () => {
    await expect(
      bridge.submit({ sessionId: '', nodeId: NODE_A, request: ADD_CHILD }),
    ).resolves.toEqual(expect.objectContaining({ ok: false }));
    expect(sendToRenderer).not.toHaveBeenCalled();
  });

  it('returns an error when nodeId is empty (defensive guard)', async () => {
    await expect(
      bridge.submit({ sessionId: SESSION_ID, nodeId: '', request: ADD_CHILD }),
    ).resolves.toEqual(expect.objectContaining({ ok: false }));
    expect(sendToRenderer).not.toHaveBeenCalled();
  });
});

describe('createMcpProposalBridge — dispose', () => {
  it('dispose resolves pending submissions with an error and unsubscribes', async () => {
    vi.useFakeTimers();
    const sendToRenderer = vi.fn();
    const channel = makeFakeResponseChannel();
    const bridge = createMcpProposalBridge({
      sendToRenderer,
      onRendererResponse: channel.onResponse,
      timeoutMs: 5000,
    });

    const pending = bridge.submit({ sessionId: SESSION_ID, nodeId: NODE_A, request: ADD_CHILD });
    bridge.dispose();

    vi.advanceTimersByTime(100);
    await expect(pending).resolves.toEqual(
      expect.objectContaining({ ok: false, error: expect.stringMatching(/disposed/i) }),
    );
    vi.useRealTimers();
  });
});
