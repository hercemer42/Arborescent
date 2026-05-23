import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createHookEventDispatcher } from '../hookEventDispatcher';
import { SessionBindingRegistry } from '../sessionBindingRegistry';
import { ArborescentMcpServer } from '../mcpServer';
import { HookEventPayload } from '../hookServer';
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

describe('createHookEventDispatcher — register-binding routing', () => {
  let registry: SessionBindingRegistry;
  let server: ArborescentMcpServer;
  let forwardToRenderer: ReturnType<typeof vi.fn>;
  let dispatch: ReturnType<typeof createHookEventDispatcher>;

  beforeEach(() => {
    const made = makeFakeMcpServer();
    server = made.server;
    registry = made.registry;
    forwardToRenderer = vi.fn();
    dispatch = createHookEventDispatcher({
      getMcpServer: () => server,
      forwardToRenderer,
    });
  });

  it('register-binding routes to the registry and does NOT forward to renderer', () => {
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-a',
    });

    expect(registry.lookup('sess-1')).toBe('node-a');
    expect(forwardToRenderer).not.toHaveBeenCalled();
  });

  it('does nothing when register-binding payload lacks node_uuid', () => {
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
    });

    expect(registry.lookup('sess-1')).toBe(null);
    expect(forwardToRenderer).not.toHaveBeenCalled();
  });

  it('register-binding for an already-bound same pair is a no-op classification', () => {
    registry.register('sess-1', 'node-a');
    const listener = vi.fn();
    registry.onRebindRequest(listener);

    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-a',
    });

    expect(listener).not.toHaveBeenCalled();
    expect(registry.lookup('sess-1')).toBe('node-a');
  });

  it('register-binding for a different node emits a rebind-request event via the registry', () => {
    registry.register('sess-1', 'node-a');
    const listener = vi.fn();
    registry.onRebindRequest(listener);

    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-b',
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      previousNodeId: 'node-a',
      newNodeId: 'node-b',
    });
    expect(registry.lookup('sess-1')).toBe('node-a');
  });

  it('drops register-binding cleanly when MCP server is not available', () => {
    const dispatchNoMcp = createHookEventDispatcher({
      getMcpServer: () => null,
      forwardToRenderer,
    });

    dispatchNoMcp({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-a',
    });

    expect(forwardToRenderer).not.toHaveBeenCalled();
  });
});

describe('createHookEventDispatcher — other events forward to renderer', () => {
  let forwardToRenderer: ReturnType<typeof vi.fn>;
  let dispatch: ReturnType<typeof createHookEventDispatcher>;

  beforeEach(() => {
    const { server } = makeFakeMcpServer();
    forwardToRenderer = vi.fn();
    dispatch = createHookEventDispatcher({
      getMcpServer: () => server,
      forwardToRenderer,
    });
  });

  it('forwards a NeedsReview event to renderer with the payload intact', () => {
    const payload: HookEventPayload = {
      session_id: 'sess-1',
      hook_event_name: 'NeedsReview',
      terminal_id: 'term-1',
    };
    dispatch(payload);
    expect(forwardToRenderer).toHaveBeenCalledWith(payload);
  });

  it('forwards a SessionStart event to renderer (existing behavior — main process side-effects in PR2 are register-binding only)', () => {
    const payload: HookEventPayload = {
      session_id: 'sess-1',
      hook_event_name: 'SessionStart',
    };
    dispatch(payload);
    expect(forwardToRenderer).toHaveBeenCalledWith(payload);
  });

  it('forwards an unknown event to renderer (defensive default)', () => {
    const payload: HookEventPayload = {
      session_id: 'sess-1',
      hook_event_name: 'SomeFutureEvent',
    };
    dispatch(payload);
    expect(forwardToRenderer).toHaveBeenCalledWith(payload);
  });

  it('does NOT forward a register-binding event to renderer verbatim (main-process internal)', () => {
    // Even when US-E adds session-terminal-mapping forwarding, the original
    // register-binding payload — carrying node_uuid — must never reach the
    // renderer. Binding logic stays main-process-only.
    const payload: HookEventPayload = {
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-a',
    };
    dispatch(payload);
    expect(forwardToRenderer).not.toHaveBeenCalledWith(payload);
    expect(forwardToRenderer).not.toHaveBeenCalledWith(
      expect.objectContaining({ hook_event_name: 'register-binding' }),
    );
  });
});

describe('createHookEventDispatcher — session-terminal-mapping forwarding from register-binding (US-E)', () => {
  // The hook scripts now include ARBORESCENT_TERMINAL_ID on register-binding
  // POSTs. The dispatcher uses that to emit a lightweight, separately-named
  // event to the renderer carrying just {session_id, terminal_id} so the
  // workflowSessionMap stays accurate on every prompt — not only when
  // Arborescent itself opens a terminal.
  let registry: SessionBindingRegistry;
  let server: ArborescentMcpServer;
  let forwardToRenderer: ReturnType<typeof vi.fn>;
  let dispatch: ReturnType<typeof createHookEventDispatcher>;

  beforeEach(() => {
    const made = makeFakeMcpServer();
    server = made.server;
    registry = made.registry;
    forwardToRenderer = vi.fn();
    dispatch = createHookEventDispatcher({
      getMcpServer: () => server,
      forwardToRenderer,
    });
  });

  it('forwards a session-terminal-mapping event when register-binding carries terminal_id', () => {
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-a',
      terminal_id: 'term-1',
    });

    expect(forwardToRenderer).toHaveBeenCalledTimes(1);
    expect(forwardToRenderer).toHaveBeenCalledWith({
      session_id: 'sess-1',
      hook_event_name: 'session-terminal-mapping',
      terminal_id: 'term-1',
    });
  });

  it('the forwarded event does NOT include node_uuid — binding logic stays main-process-only', () => {
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-a',
      terminal_id: 'term-1',
    });

    const forwarded = forwardToRenderer.mock.calls[0][0] as HookEventPayload;
    expect(forwarded.node_uuid).toBeUndefined();
    expect(Object.keys(forwarded).sort()).toEqual(
      ['hook_event_name', 'session_id', 'terminal_id'].sort(),
    );
  });

  it('does NOT forward when register-binding has no terminal_id (foreign / misconfigured terminal)', () => {
    // Falling back to "no forward" matches the foreign-sessions-unsupported
    // contract: without ARBORESCENT_TERMINAL_ID in the env, Arborescent has
    // nothing to map to and the renderer keeps its prior view.
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-a',
    });

    expect(forwardToRenderer).not.toHaveBeenCalled();
  });

  it('still performs the existing binding-registry side effects regardless of terminal_id presence', () => {
    // The session-terminal-mapping forwarding is additive — it must not affect
    // the registry.register flow that US-B / US-C tests already pin down.
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-a',
      terminal_id: 'term-1',
    });

    expect(registry.lookup('sess-1')).toBe('node-a');
  });

  it('does NOT forward when payload has terminal_id but the dispatcher rejects the event upstream (empty node_uuid)', () => {
    // If the register-binding handler short-circuits (missing node_uuid),
    // there is no successful event to mirror to the renderer.
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      terminal_id: 'term-1',
    });

    expect(forwardToRenderer).not.toHaveBeenCalled();
    expect(registry.lookup('sess-1')).toBe(null);
  });

  it('forwards even when the binding result is a no-op (same session re-binding the same node in the same terminal)', () => {
    // A user typing successive prompts on a long-running session emits
    // register-binding every time. Even a no-op binding still represents a
    // live session→terminal pairing worth re-asserting.
    registry.register('sess-1', 'node-a');

    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-a',
      terminal_id: 'term-1',
    });

    expect(forwardToRenderer).toHaveBeenCalledWith(
      expect.objectContaining({
        hook_event_name: 'session-terminal-mapping',
        session_id: 'sess-1',
        terminal_id: 'term-1',
      }),
    );
  });
});

describe('createHookEventDispatcher — Stop forwarding attaches the explicit-submit gate', () => {
  let oneShot: OneShotTargetStore;
  let server: ArborescentMcpServer;
  let forwardToRenderer: ReturnType<typeof vi.fn>;
  let dispatch: ReturnType<typeof createHookEventDispatcher>;

  beforeEach(() => {
    const made = makeFakeMcpServer();
    server = made.server;
    oneShot = made.oneShot;
    forwardToRenderer = vi.fn();
    dispatch = createHookEventDispatcher({
      getMcpServer: () => server,
      forwardToRenderer,
    });
  });

  it('Stop forwards explicit_submit_seen=true when an explicit submit happened this turn', () => {
    oneShot.setExplicitSubmitSeenThisTurn('sess-1', true);

    dispatch({ session_id: 'sess-1', hook_event_name: 'Stop' });

    expect(forwardToRenderer).toHaveBeenCalledWith(
      expect.objectContaining({ hook_event_name: 'Stop', explicit_submit_seen: true }),
    );
  });

  it('Stop forwards explicit_submit_seen=false when no explicit submit happened this turn', () => {
    dispatch({ session_id: 'sess-1', hook_event_name: 'Stop' });

    expect(forwardToRenderer).toHaveBeenCalledWith(
      expect.objectContaining({ hook_event_name: 'Stop', explicit_submit_seen: false }),
    );
  });

  it('non-Stop events do NOT receive an explicit_submit_seen attachment', () => {
    oneShot.setExplicitSubmitSeenThisTurn('sess-1', true);

    dispatch({ session_id: 'sess-1', hook_event_name: 'UserPromptSubmit' });

    const forwarded = forwardToRenderer.mock.calls[0][0] as HookEventPayload;
    expect(forwarded.hook_event_name).toBe('UserPromptSubmit');
    expect(forwarded.explicit_submit_seen).toBeUndefined();
  });

  it('Stop forwarding without an MCP server falls back to the payload unchanged', () => {
    const fallback = createHookEventDispatcher({
      getMcpServer: () => null,
      forwardToRenderer,
    });

    fallback({ session_id: 'sess-1', hook_event_name: 'Stop' });

    const forwarded = forwardToRenderer.mock.calls[0][0] as HookEventPayload;
    expect(forwarded.hook_event_name).toBe('Stop');
    expect(forwarded.explicit_submit_seen).toBeUndefined();
  });

  it('register-target resets explicit_submit_seen so the previous turn does not leak into the next Stop', () => {
    oneShot.setExplicitSubmitSeenThisTurn('sess-1', true);

    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-target',
      target_node_uuid: 'node-a',
      marker_seen_this_turn: true,
    });

    expect(oneShot.wasExplicitSubmitSeenThisTurn('sess-1')).toBe(false);
  });

  it('two Stops in one turn do not double-advance — the flag is cleared after the first Stop forwarding', () => {
    oneShot.setExplicitSubmitSeenThisTurn('sess-1', true);

    dispatch({ session_id: 'sess-1', hook_event_name: 'Stop' });
    dispatch({ session_id: 'sess-1', hook_event_name: 'Stop' });

    const firstForward = forwardToRenderer.mock.calls[0][0] as HookEventPayload;
    const secondForward = forwardToRenderer.mock.calls[1][0] as HookEventPayload;
    expect(firstForward.explicit_submit_seen).toBe(true);
    expect(secondForward.explicit_submit_seen).toBe(false);
  });
});

