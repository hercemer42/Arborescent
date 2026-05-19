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

