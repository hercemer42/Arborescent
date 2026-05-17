import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { createHookEventDispatcher } from '../hookEventDispatcher';
import { SessionBindingRegistry } from '../sessionBindingRegistry';
import { ArborescentMcpServer } from '../mcpServer';
import { HookEventPayload } from '../hookServer';
import { SubmitMarker } from '../submitMarker';

function makeFakeMcpServer(): {
  server: ArborescentMcpServer;
  registry: SessionBindingRegistry;
  marker: SubmitMarker;
} {
  const registry = new SessionBindingRegistry();
  const marker = new SubmitMarker();
  const server = {
    getBindingRegistry: () => registry,
    getSubmitMarker: () => marker,
  } as unknown as ArborescentMcpServer;
  return { server, registry, marker };
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

  it('does NOT forward a register-binding event to renderer (main-process internal)', () => {
    const payload: HookEventPayload = {
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-a',
    };
    dispatch(payload);
    expect(forwardToRenderer).not.toHaveBeenCalled();
  });
});

describe('createHookEventDispatcher — submit-marker reset on register-binding (PR6)', () => {
  // Every register-binding marks a new turn boundary (UserPromptSubmit fires
  // register-binding for every Arborescent-driven prompt). Resetting the
  // marker here is what lets the auto-submit safety net fire again on the
  // next turn instead of being permanently deduped.
  let registry: SessionBindingRegistry;
  let marker: SubmitMarker;
  let server: ArborescentMcpServer;
  let dispatch: ReturnType<typeof createHookEventDispatcher>;

  beforeEach(() => {
    registry = new SessionBindingRegistry();
    marker = new SubmitMarker();
    server = {
      getBindingRegistry: () => registry,
      getSubmitMarker: () => marker,
    } as unknown as ArborescentMcpServer;
    dispatch = createHookEventDispatcher({
      getMcpServer: () => server,
      forwardToRenderer: vi.fn(),
    });
  });

  it('resets the marker for the session when register-binding fires (new turn boundary)', () => {
    marker.markSubmitted('sess-1');
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-a',
    });
    expect(marker.hasSubmitted('sess-1')).toBe(false);
  });

  it('does not reset markers for unrelated sessions', () => {
    marker.markSubmitted('sess-1');
    marker.markSubmitted('sess-2');
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-a',
    });
    expect(marker.hasSubmitted('sess-2')).toBe(true);
  });

  it('reset still happens when the binding is a no-op classification (same node)', () => {
    registry.register('sess-1', 'node-a');
    marker.markSubmitted('sess-1');
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-a',
    });
    expect(marker.hasSubmitted('sess-1')).toBe(false);
  });

  it('does NOT reset on rebind-needed — the old binding is still active until the user confirms', () => {
    // Resetting here would let the safety net land this turn's content on the OLD node
    // while the rebind dialog is still pending. RebindIpcBridge.confirmRebind handles
    // the marker reset when the user actually accepts the swap.
    registry.register('sess-1', 'node-a');
    marker.markSubmitted('sess-1');
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-b',
    });
    expect(marker.hasSubmitted('sess-1')).toBe(true);
  });
});
