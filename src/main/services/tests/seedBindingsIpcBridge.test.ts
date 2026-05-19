import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import {
  createSeedBindingsIpcBridge,
  SeedBindingsIpcBridge,
  SEED_BINDINGS_CHANNEL,
  CLEAR_BINDINGS_CHANNEL,
  SeedPair,
} from '../seedBindingsIpcBridge';

describe('createSeedBindingsIpcBridge — seed (file open rehydration)', () => {
  let registry: SessionBindingRegistry;
  let bridge: SeedBindingsIpcBridge;

  beforeEach(() => {
    registry = new SessionBindingRegistry();
    bridge = createSeedBindingsIpcBridge({ registry });
  });

  it('seed with N distinct pairs registers N bindings, all classified as set', () => {
    const pairs: SeedPair[] = [
      { sessionId: 'sess-1', nodeId: 'node-a' },
      { sessionId: 'sess-2', nodeId: 'node-b' },
      { sessionId: 'sess-3', nodeId: 'node-c' },
    ];

    const results = bridge.seed(pairs);

    expect(results).toHaveLength(3);
    expect(results.every((r) => r?.kind === 'set')).toBe(true);
    expect(registry.lookup('sess-1')).toBe('node-a');
    expect(registry.lookup('sess-2')).toBe('node-b');
    expect(registry.lookup('sess-3')).toBe('node-c');
  });

  it('seed with an empty array is a no-op and returns empty results', () => {
    const results = bridge.seed([]);
    expect(results).toEqual([]);
  });

  it('seed with a pair containing empty sessionId or nodeId skips that pair without throwing', () => {
    const pairs: SeedPair[] = [
      { sessionId: '', nodeId: 'node-a' },
      { sessionId: 'sess-1', nodeId: '' },
      { sessionId: 'sess-2', nodeId: 'node-b' },
    ];

    expect(() => bridge.seed(pairs)).not.toThrow();
    expect(registry.lookup('')).toBe(null);
    expect(registry.lookup('sess-1')).toBe(null);
    expect(registry.lookup('sess-2')).toBe('node-b');
  });

  it('seeding the same pair twice classifies the second as no-op rather than rebind', () => {
    bridge.seed([{ sessionId: 'sess-1', nodeId: 'node-a' }]);
    const results = bridge.seed([{ sessionId: 'sess-1', nodeId: 'node-a' }]);

    expect(results[0]).toEqual({ kind: 'no-op', sessionId: 'sess-1', nodeId: 'node-a' });
    expect(registry.lookup('sess-1')).toBe('node-a');
  });

  it('seed does not emit any rebind-request event when targets are unbound', () => {
    const listener = vi.fn();
    registry.onRebindRequest(listener);

    bridge.seed([
      { sessionId: 'sess-1', nodeId: 'node-a' },
      { sessionId: 'sess-2', nodeId: 'node-b' },
    ]);

    expect(listener).not.toHaveBeenCalled();
  });

  it('seed of a pair whose sessionId is already bound to a DIFFERENT node classifies as rebind-needed (cross-file conflict)', () => {
    bridge.seed([{ sessionId: 'sess-1', nodeId: 'node-a' }]);

    const results = bridge.seed([{ sessionId: 'sess-1', nodeId: 'node-different' }]);

    expect(results[0]?.kind).toBe('rebind-needed');
    expect(registry.lookup('sess-1')).toBe('node-a');
    expect(registry.pendingRebind('sess-1')).toBe('node-different');
  });
});

describe('createSeedBindingsIpcBridge — clear (file close)', () => {
  let registry: SessionBindingRegistry;
  let bridge: SeedBindingsIpcBridge;

  beforeEach(() => {
    registry = new SessionBindingRegistry();
    bridge = createSeedBindingsIpcBridge({ registry });
  });

  it('clear drops only the named sessionIds and leaves the rest intact', () => {
    bridge.seed([
      { sessionId: 'sess-1', nodeId: 'node-a' },
      { sessionId: 'sess-2', nodeId: 'node-b' },
      { sessionId: 'sess-3', nodeId: 'node-c' },
    ]);

    const removed = bridge.clear(['sess-1', 'sess-3']);

    expect(removed).toBe(2);
    expect(registry.lookup('sess-1')).toBe(null);
    expect(registry.lookup('sess-2')).toBe('node-b');
    expect(registry.lookup('sess-3')).toBe(null);
  });

  it('clear with an empty array is a no-op', () => {
    bridge.seed([{ sessionId: 'sess-1', nodeId: 'node-a' }]);
    expect(bridge.clear([])).toBe(0);
    expect(registry.lookup('sess-1')).toBe('node-a');
  });

  it('clear with sessionIds not present in the registry is a safe no-op', () => {
    bridge.seed([{ sessionId: 'sess-1', nodeId: 'node-a' }]);
    expect(bridge.clear(['sess-never-seen'])).toBe(0);
    expect(registry.lookup('sess-1')).toBe('node-a');
  });

  it('clear of file-A sessionIds does not affect file-B sessionIds (multi-file isolation)', () => {
    bridge.seed([
      { sessionId: 'fileA-sess-1', nodeId: 'nodeA1' },
      { sessionId: 'fileA-sess-2', nodeId: 'nodeA2' },
    ]);
    bridge.seed([
      { sessionId: 'fileB-sess-1', nodeId: 'nodeB1' },
      { sessionId: 'fileB-sess-2', nodeId: 'nodeB2' },
    ]);

    bridge.clear(['fileA-sess-1', 'fileA-sess-2']);

    expect(registry.lookup('fileA-sess-1')).toBe(null);
    expect(registry.lookup('fileA-sess-2')).toBe(null);
    expect(registry.lookup('fileB-sess-1')).toBe('nodeB1');
    expect(registry.lookup('fileB-sess-2')).toBe('nodeB2');
  });

  it('clear with empty-string sessionId entries skips them without throwing', () => {
    bridge.seed([{ sessionId: 'sess-1', nodeId: 'node-a' }]);
    expect(() => bridge.clear(['', 'sess-1'])).not.toThrow();
    expect(registry.lookup('sess-1')).toBe(null);
  });
});

describe('createSeedBindingsIpcBridge — IPC channel constants', () => {
  it('exposes a stable seed channel name', () => {
    expect(SEED_BINDINGS_CHANNEL).toBe('mcp:seed-bindings');
  });

  it('exposes a stable clear channel name distinct from seed', () => {
    expect(CLEAR_BINDINGS_CHANNEL).toBe('mcp:clear-bindings');
    expect(CLEAR_BINDINGS_CHANNEL).not.toBe(SEED_BINDINGS_CHANNEL);
  });
});

describe('createSeedBindingsIpcBridge — dispose', () => {
  it('dispose is callable and idempotent (defensive cleanup hook for parity with other bridges)', () => {
    const registry = new SessionBindingRegistry();
    const bridge = createSeedBindingsIpcBridge({ registry });
    expect(() => {
      bridge.dispose();
      bridge.dispose();
    }).not.toThrow();
  });
});
