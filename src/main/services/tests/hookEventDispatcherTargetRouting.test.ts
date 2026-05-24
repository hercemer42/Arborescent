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

describe('createHookEventDispatcher — register-target routing (US-B)', () => {
  // register-target is emitted by the UserPromptSubmit hook on EVERY prompt.
  // It carries the per-turn one-shot target (when an ARBORESCENT_TARGET marker
  // was present) and the markerSeenThisTurn flag (true if either marker was
  // present this turn). The dispatcher uses it to set/clear pendingTarget and
  // to gate the Stop-hook safety net via OneShotTargetStore.
  let registry: SessionBindingRegistry;
  let oneShot: OneShotTargetStore;
  let server: ArborescentMcpServer;
  let forwardToRenderer: ReturnType<typeof vi.fn>;
  let dispatch: ReturnType<typeof createHookEventDispatcher>;

  beforeEach(() => {
    const made = makeFakeMcpServer();
    server = made.server;
    registry = made.registry;
    oneShot = made.oneShot;
    forwardToRenderer = vi.fn();
    dispatch = createHookEventDispatcher({
      getMcpServer: () => server,
      forwardToRenderer,
    });
  });

  it('sets pendingTarget on the one-shot store and does NOT forward to renderer', () => {
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-target',
      target_node_uuid: 'node-target',
      marker_seen_this_turn: true,
    });

    expect(oneShot.pendingTarget('sess-1')).toBe('node-target');
    expect(forwardToRenderer).not.toHaveBeenCalled();
  });

  it('preserves pendingTarget when target_node_uuid is omitted — manual collabs persist across follow-up prompts', () => {
    // Under the manual-collab lifetime model, register-target with no marker
    // (the steady-state UserPromptSubmit case) MUST NOT clear an in-flight
    // manual route. The route lives until the renderer explicitly signals
    // resolution via `markManualCollabResolved`. This guarantees the
    // discuss-then-refresh loop survives across follow-up prompts.
    oneShot.setPendingTarget('sess-1', 'route-node');
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-target',
      marker_seen_this_turn: false,
    });

    expect(oneShot.pendingTarget('sess-1')).toBe('route-node');
  });

  it('preserves pendingTarget when target_node_uuid is explicitly empty string — same persistence rule', () => {
    oneShot.setPendingTarget('sess-1', 'route-node');
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-target',
      target_node_uuid: '',
      marker_seen_this_turn: false,
    });

    expect(oneShot.pendingTarget('sess-1')).toBe('route-node');
  });

  it('replaces pendingTarget when a fresh register-target arrives with a different target_node_uuid — last write wins', () => {
    // A new manual send on the same session must override any stale route.
    // set-is-overwrite makes this work; this test pins the contract alongside
    // the persistence rules.
    oneShot.setPendingTarget('sess-1', 'old-route');
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-target',
      target_node_uuid: 'new-route',
      marker_seen_this_turn: true,
    });

    expect(oneShot.pendingTarget('sess-1')).toBe('new-route');
  });

  it('records markerSeenThisTurn=true when the payload says so', () => {
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-target',
      target_node_uuid: 'node-target',
      marker_seen_this_turn: true,
    });

    expect(oneShot.wasMarkerSeenThisTurn('sess-1')).toBe(true);
  });

  it('records markerSeenThisTurn=false when the payload reports an unmarked prompt', () => {
    // The hook emits exactly ONE register-target per UserPromptSubmit, so
    // flip-flop within a turn is out of scope. Tested in isolation.
    oneShot.setMarkerSeenThisTurn('sess-1', true);
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-target',
      marker_seen_this_turn: false,
    });

    expect(oneShot.wasMarkerSeenThisTurn('sess-1')).toBe(false);
  });

  it('a register-target event does NOT mutate the binding registry', () => {
    // The whole point of two distinct markers: target sends route a single
    // response without touching the session binding.
    registry.register('sess-1', 'binding-node');
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-target',
      target_node_uuid: 'node-target',
      marker_seen_this_turn: true,
    });

    expect(registry.lookup('sess-1')).toBe('binding-node');
  });

  it('register-target is per-session — sess-2 pendingTarget is unaffected when sess-1 dispatches', () => {
    oneShot.setPendingTarget('sess-2', 'sess-2-target');
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-target',
      target_node_uuid: 'sess-1-target',
      marker_seen_this_turn: true,
    });

    expect(oneShot.pendingTarget('sess-2')).toBe('sess-2-target');
  });

  it('drops register-target cleanly when MCP server is not available', () => {
    const dispatchNoMcp = createHookEventDispatcher({
      getMcpServer: () => null,
      forwardToRenderer,
    });

    dispatchNoMcp({
      session_id: 'sess-1',
      hook_event_name: 'register-target',
      target_node_uuid: 'node-target',
      marker_seen_this_turn: true,
    });

    expect(forwardToRenderer).not.toHaveBeenCalled();
  });

  it('register-target with no session_id is dropped silently — no pendingTarget set on an empty key', () => {
    dispatch({
      session_id: '',
      hook_event_name: 'register-target',
      target_node_uuid: 'node-target',
      marker_seen_this_turn: true,
    } as HookEventPayload);

    expect(oneShot.pendingTarget('')).toBe(null);
  });
});

describe('createHookEventDispatcher — register-binding interplay with markerSeenThisTurn (US-B)', () => {
  // Per the spec — "markerSeenThisTurn is true if either marker is present
  // this turn" — the dispatcher must record markerSeenThisTurn=true when
  // register-binding fires so the safety net is allowed to run even if the
  // target marker happened to be absent.
  let oneShot: OneShotTargetStore;
  let server: ArborescentMcpServer;
  let dispatch: ReturnType<typeof createHookEventDispatcher>;

  beforeEach(() => {
    const made = makeFakeMcpServer();
    server = made.server;
    oneShot = made.oneShot;
    dispatch = createHookEventDispatcher({
      getMcpServer: () => server,
      forwardToRenderer: vi.fn(),
    });
  });

  it('register-binding sets markerSeenThisTurn=true so the Stop-hook gate allows the safety net to fire', () => {
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-a',
    });
    expect(oneShot.wasMarkerSeenThisTurn('sess-1')).toBe(true);
  });

  it('register-binding does NOT touch pendingTarget — binding and target are orthogonal axes', () => {
    oneShot.setPendingTarget('sess-1', 'existing-target');
    dispatch({
      session_id: 'sess-1',
      hook_event_name: 'register-binding',
      node_uuid: 'node-a',
    });
    expect(oneShot.pendingTarget('sess-1')).toBe('existing-target');
  });
});

