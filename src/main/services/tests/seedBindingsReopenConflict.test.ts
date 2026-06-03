import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SessionBindingRegistry, RebindRequest } from '../sessionBindingRegistry';
import { createSeedBindingsIpcBridge, SeedBindingsIpcBridge } from '../seedBindingsIpcBridge';

// File-reopen seeding conflict: when a reopened .arbo carries stale persisted
// metadata (node.metadata.sessionId pointing at the pre-rebind node) while the
// live registry already holds the post-rebind binding, seeding must route the
// conflict through the pendingRebind flow — never silently overwrite the
// registry. The hint seeds; it does not rule.

const SESSION = 'session-1';
const STALE_NODE = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const LIVE_NODE = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';

describe('file-reopen seeding conflict — stale metadata vs live registry binding', () => {
  let registry: SessionBindingRegistry;
  let bridge: SeedBindingsIpcBridge;
  let rebindRequests: RebindRequest[];

  beforeEach(() => {
    registry = new SessionBindingRegistry();
    bridge = createSeedBindingsIpcBridge({ registry });
    rebindRequests = [];
    registry.onRebindRequest((request) => rebindRequests.push(request));
  });

  it('seeding a stale pair against a live binding reports rebind-needed instead of overwriting', () => {
    registry.register(SESSION, LIVE_NODE);

    const results = bridge.seed([{ sessionId: SESSION, nodeId: STALE_NODE }]);

    expect(results[0]?.kind).toBe('rebind-needed');
    expect(registry.lookup(SESSION)).toBe(LIVE_NODE);
  });

  it('the conflict emits a rebind request carrying the live node as previous and the stale node as new', () => {
    registry.register(SESSION, LIVE_NODE);

    bridge.seed([{ sessionId: SESSION, nodeId: STALE_NODE }]);

    expect(rebindRequests).toEqual([
      { sessionId: SESSION, previousNodeId: LIVE_NODE, newNodeId: STALE_NODE },
    ]);
    expect(registry.pendingRebind(SESSION)).toBe(STALE_NODE);
  });

  it('confirming the pending rebind adopts the seeded node; until then the live binding stands', () => {
    registry.register(SESSION, LIVE_NODE);
    bridge.seed([{ sessionId: SESSION, nodeId: STALE_NODE }]);

    expect(registry.lookup(SESSION)).toBe(LIVE_NODE);
    registry.confirmRebind(SESSION);
    expect(registry.lookup(SESSION)).toBe(STALE_NODE);
  });

  it('cancelling the pending rebind keeps the live binding and clears the pending entry', () => {
    registry.register(SESSION, LIVE_NODE);
    bridge.seed([{ sessionId: SESSION, nodeId: STALE_NODE }]);

    registry.cancelRebind(SESSION);

    expect(registry.lookup(SESSION)).toBe(LIVE_NODE);
    expect(registry.pendingRebind(SESSION)).toBeNull();
  });

  it('seeding the pair the registry already holds is a no-op with no rebind request', () => {
    registry.register(SESSION, LIVE_NODE);

    const results = bridge.seed([{ sessionId: SESSION, nodeId: LIVE_NODE }]);

    expect(results[0]?.kind).toBe('no-op');
    expect(rebindRequests).toEqual([]);
  });

  it('re-seeding the same conflicting pair does not emit a duplicate rebind request', () => {
    registry.register(SESSION, LIVE_NODE);

    bridge.seed([{ sessionId: SESSION, nodeId: STALE_NODE }]);
    bridge.seed([{ sessionId: SESSION, nodeId: STALE_NODE }]);

    expect(rebindRequests).toHaveLength(1);
  });

  it('seeding into an empty registry sets the binding directly — no rebind flow on first open', () => {
    const results = bridge.seed([{ sessionId: SESSION, nodeId: STALE_NODE }]);

    expect(results[0]?.kind).toBe('set');
    expect(registry.lookup(SESSION)).toBe(STALE_NODE);
    expect(rebindRequests).toEqual([]);
  });

  it('an empty seed batch returns no results and touches nothing', () => {
    registry.register(SESSION, LIVE_NODE);

    expect(bridge.seed([])).toEqual([]);
    expect(registry.lookup(SESSION)).toBe(LIVE_NODE);
    expect(rebindRequests).toEqual([]);
  });

  it('a pair with an empty sessionId or nodeId yields a null result and leaves the registry untouched', () => {
    registry.register(SESSION, LIVE_NODE);

    const results = bridge.seed([
      { sessionId: '', nodeId: STALE_NODE },
      { sessionId: SESSION, nodeId: '' },
    ]);

    expect(results).toEqual([null, null]);
    expect(registry.lookup(SESSION)).toBe(LIVE_NODE);
    expect(rebindRequests).toEqual([]);
  });

  it('a conflict on one session does not disturb seeding of an unrelated session in the same batch', () => {
    const otherSession = 'session-2';
    registry.register(SESSION, LIVE_NODE);

    const results = bridge.seed([
      { sessionId: SESSION, nodeId: STALE_NODE },
      { sessionId: otherSession, nodeId: STALE_NODE },
    ]);

    expect(results[0]?.kind).toBe('rebind-needed');
    expect(results[1]?.kind).toBe('set');
    expect(registry.lookup(otherSession)).toBe(STALE_NODE);
  });
});
