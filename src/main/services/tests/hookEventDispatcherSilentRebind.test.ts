import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createHookEventDispatcher } from '../hookEventDispatcher';
import { SessionBindingRegistry } from '../sessionBindingRegistry';
import { ArborescentMcpServer } from '../mcpServer';
import { OneShotTargetStore } from '../oneShotTargetStore';

function makeFakeMcpServer(): {
  server: ArborescentMcpServer;
  registry: SessionBindingRegistry;
  oneShot: OneShotTargetStore;
} {
  const registry = new SessionBindingRegistry();
  const oneShot = new OneShotTargetStore();
  const server = {
    getBindingRegistry: () => registry,
    getOneShotTargetStore: () => oneShot,
  } as unknown as ArborescentMcpServer;
  return { server, registry, oneShot };
}

const NODE_A = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const NODE_B = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';

describe('createHookEventDispatcher — silent rebind on workflow-advance source', () => {
  // The hook script forwards the source token from the binding marker into the
  // register-binding payload. The dispatcher routes the rebind-needed case
  // based on that source:
  //   workflow-advance → register(autoConfirm) applies the binding silently
  //                      (hand-off between decomposed siblings during recurse)
  //   workflow-start   → leave pending so the rebind dialog can fire
  //   anything else / missing → leave pending (legacy behavior)
  let registry: SessionBindingRegistry;
  let server: ArborescentMcpServer;
  let dispatch: ReturnType<typeof createHookEventDispatcher>;
  let rebindListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const made = makeFakeMcpServer();
    server = made.server;
    registry = made.registry;
    rebindListener = vi.fn();
    registry.onRebindRequest(rebindListener);
    dispatch = createHookEventDispatcher({
      getMcpServer: () => server,
      forwardToRenderer: vi.fn(),
    });
  });

  it('workflow-advance source flips the binding silently when rebind-needed', () => {
    // Sibling iteration via decomposition + recurse: register-binding fires
    // for the next sibling on a session already bound to the prior sibling.
    // We expect the registry to update to NODE_B without leaving a pending
    // rebind for the renderer to dialog about.
    registry.register('sess-1', NODE_A);

    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: NODE_B,
      source: 'workflow-advance',
    });

    expect(registry.lookup('sess-1')).toBe(NODE_B);
    expect(registry.pendingRebind('sess-1')).toBe(null);
  });

  it('workflow-start source on an existing binding leaves the rebind pending so the dialog can fire', () => {
    // User clicks Start Workflow on a node X with a terminal already bound
    // to a different node Y — the user must confirm. The dispatcher must NOT
    // silently flip; it must leave the registry in rebind-needed.
    registry.register('sess-1', NODE_A);

    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: NODE_B,
      source: 'workflow-start',
    });

    expect(registry.lookup('sess-1')).toBe(NODE_A);
    expect(registry.pendingRebind('sess-1')).toBe(NODE_B);
  });

  it('a missing source field also leaves the rebind pending (legacy / freeform prompts)', () => {
    // Backwards compat: register-binding payloads without a source token
    // behave as they always have — pending rebind, dialog fires.
    registry.register('sess-1', NODE_A);

    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: NODE_B,
    });

    expect(registry.lookup('sess-1')).toBe(NODE_A);
    expect(registry.pendingRebind('sess-1')).toBe(NODE_B);
  });

  it('an unknown source value also leaves the rebind pending — only workflow-advance is privileged', () => {
    registry.register('sess-1', NODE_A);

    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: NODE_B,
      source: 'some-future-source',
    });

    expect(registry.lookup('sess-1')).toBe(NODE_A);
    expect(registry.pendingRebind('sess-1')).toBe(NODE_B);
  });

  it('workflow-advance on a fresh session is a normal first-time set (no rebind to silence)', () => {
    // First-time binding doesn't go through rebind-needed at all — confirmRebind
    // must not be called as a side effect, and no event should fire.
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: NODE_A,
      source: 'workflow-advance',
    });

    expect(registry.lookup('sess-1')).toBe(NODE_A);
    expect(registry.pendingRebind('sess-1')).toBe(null);
    expect(rebindListener).not.toHaveBeenCalled();
  });

  it('workflow-advance on the same node is a no-op — registry stays put, no rebind, no listener call', () => {
    registry.register('sess-1', NODE_A);

    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: NODE_A,
      source: 'workflow-advance',
    });

    expect(registry.lookup('sess-1')).toBe(NODE_A);
    expect(registry.pendingRebind('sess-1')).toBe(null);
    expect(rebindListener).not.toHaveBeenCalled();
  });

  it('workflow-advance silent rebind still sets markerSeenThisTurn so the safety net stays consistent', () => {
    // The marker-seen flag is what gates the Stop-hook safety net (US-B).
    // A silent rebind is still a marker-bearing prompt; the flag must flip.
    registry.register('sess-1', NODE_A);

    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: NODE_B,
      source: 'workflow-advance',
    });

    expect(server.getOneShotTargetStore().wasMarkerSeenThisTurn('sess-1')).toBe(true);
  });
});

describe('createHookEventDispatcher — workflow-advance rebind does not surface the renderer dialog (orphaned-dialog bug)', () => {
  // Regression for the autoplay stall. register() emits the rebind-request to
  // the renderer synchronously for EVERY rebind-needed, and the dispatcher then
  // auto-confirms a workflow-advance rebind server-side. Pre-fix the renderer
  // dialog was emitted-and-orphaned (the confirm never cancelled it), and
  // isRebindDialogPending then blocked the next autonomous send — autoplay
  // stalled mid-series. A silent sibling hand-off must reach the renderer with
  // NO rebind-request at all, while still flipping the binding. Non-advance
  // rebinds (workflow-start, resume, compact) MUST still surface the dialog.
  let registry: SessionBindingRegistry;
  let server: ArborescentMcpServer;
  let dispatch: ReturnType<typeof createHookEventDispatcher>;
  let rebindListener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const made = makeFakeMcpServer();
    server = made.server;
    registry = made.registry;
    rebindListener = vi.fn();
    registry.onRebindRequest(rebindListener);
    dispatch = createHookEventDispatcher({
      getMcpServer: () => server,
      forwardToRenderer: vi.fn(),
    });
  });

  it('does NOT emit a rebind-request to the renderer on a workflow-advance hand-off, yet still flips the binding', () => {
    registry.register('sess-1', NODE_A);
    rebindListener.mockClear();

    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: NODE_B,
      source: 'workflow-advance',
    });

    expect(rebindListener).not.toHaveBeenCalled();
    expect(registry.lookup('sess-1')).toBe(NODE_B);
    expect(registry.pendingRebind('sess-1')).toBe(null);
  });

  it('DOES emit a rebind-request on a workflow-start rebind so the confirmation dialog fires', () => {
    registry.register('sess-1', NODE_A);
    rebindListener.mockClear();

    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: NODE_B,
      source: 'workflow-start',
    });

    expect(rebindListener).toHaveBeenCalledTimes(1);
    expect(rebindListener).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      previousNodeId: NODE_A,
      newNodeId: NODE_B,
    });
  });

  it('DOES emit a rebind-request on a resume rebind (a genuine binding move stays gated)', () => {
    registry.register('sess-1', NODE_A);
    rebindListener.mockClear();

    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: NODE_B,
      source: 'resume',
    });

    expect(rebindListener).toHaveBeenCalledTimes(1);
  });

  it('DOES emit a rebind-request on a compact rebind (a genuine binding move stays gated)', () => {
    registry.register('sess-1', NODE_A);
    rebindListener.mockClear();

    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: NODE_B,
      source: 'compact',
    });

    expect(rebindListener).toHaveBeenCalledTimes(1);
  });
});
