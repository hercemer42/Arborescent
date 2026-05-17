import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SessionBindingRegistry, RebindRequest } from '../sessionBindingRegistry';

describe('SessionBindingRegistry — register classification', () => {
  let registry: SessionBindingRegistry;

  beforeEach(() => {
    registry = new SessionBindingRegistry();
  });

  it('classifies registering an unbound session as set and stores the binding', () => {
    const result = registry.register('sess-1', 'node-a');
    expect(result).toEqual({ kind: 'set', sessionId: 'sess-1', nodeId: 'node-a' });
    expect(registry.lookup('sess-1')).toBe('node-a');
  });

  it('classifies registering the same pair twice as no-op and does not emit any event', () => {
    const listener = vi.fn();
    registry.onRebindRequest(listener);
    registry.register('sess-1', 'node-a');
    listener.mockClear();

    const result = registry.register('sess-1', 'node-a');

    expect(result).toEqual({ kind: 'no-op', sessionId: 'sess-1', nodeId: 'node-a' });
    expect(listener).not.toHaveBeenCalled();
    expect(registry.lookup('sess-1')).toBe('node-a');
  });

  it('classifies registering a different node for a bound session as rebind-needed and does not apply yet', () => {
    registry.register('sess-1', 'node-a');

    const result = registry.register('sess-1', 'node-b');

    expect(result).toEqual({
      kind: 'rebind-needed',
      sessionId: 'sess-1',
      previousNodeId: 'node-a',
      newNodeId: 'node-b',
    });
    expect(registry.lookup('sess-1')).toBe('node-a');
    expect(registry.pendingRebind('sess-1')).toBe('node-b');
  });
});

describe('SessionBindingRegistry — rebind event emission', () => {
  let registry: SessionBindingRegistry;
  let listener: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    registry = new SessionBindingRegistry();
    listener = vi.fn();
    registry.onRebindRequest(listener);
  });

  it('emits a single rebind-request event naming both old and new node ids', () => {
    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      previousNodeId: 'node-a',
      newNodeId: 'node-b',
    } satisfies RebindRequest);
  });

  it('does not re-emit when register is called repeatedly with the same new nodeId', () => {
    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');
    listener.mockClear();

    registry.register('sess-1', 'node-b');
    registry.register('sess-1', 'node-b');

    expect(listener).not.toHaveBeenCalled();
  });

  it('emits again when register is called with a third distinct nodeId after the first rebind request', () => {
    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');
    listener.mockClear();

    registry.register('sess-1', 'node-c');

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      previousNodeId: 'node-a',
      newNodeId: 'node-c',
    });
  });

  it.todo('subscribing to rebind events after emission has already happened does not redeliver — events fire forward only');
});

describe('SessionBindingRegistry — rebind apply / cancel', () => {
  let registry: SessionBindingRegistry;

  beforeEach(() => {
    registry = new SessionBindingRegistry();
    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');
  });

  it('confirmRebind updates the registry to point at the new nodeId', () => {
    const confirmed = registry.confirmRebind('sess-1');
    expect(confirmed).toBe(true);
    expect(registry.lookup('sess-1')).toBe('node-b');
    expect(registry.pendingRebind('sess-1')).toBe(null);
  });

  it('cancelRebind leaves the registry pointing at the previous nodeId', () => {
    const cancelled = registry.cancelRebind('sess-1');
    expect(cancelled).toBe(true);
    expect(registry.lookup('sess-1')).toBe('node-a');
    expect(registry.pendingRebind('sess-1')).toBe(null);
  });

  it('confirmRebind on a session with no pending rebind returns false and does nothing', () => {
    registry.cancelRebind('sess-1');
    const confirmed = registry.confirmRebind('sess-1');
    expect(confirmed).toBe(false);
    expect(registry.lookup('sess-1')).toBe('node-a');
  });

  it('a second register call replaces the pending new nodeId rather than queueing a second request', () => {
    registry.register('sess-1', 'node-c');
    expect(registry.pendingRebind('sess-1')).toBe('node-c');

    registry.confirmRebind('sess-1');
    expect(registry.lookup('sess-1')).toBe('node-c');
  });
});

describe('SessionBindingRegistry — lookup', () => {
  let registry: SessionBindingRegistry;

  beforeEach(() => {
    registry = new SessionBindingRegistry();
  });

  it('returns the bound nodeId for a bound session', () => {
    registry.register('sess-1', 'node-a');
    expect(registry.lookup('sess-1')).toBe('node-a');
  });

  it('returns null for an unbound session', () => {
    expect(registry.lookup('sess-unknown')).toBe(null);
  });

  it('is a pure read — does not mutate state', () => {
    registry.register('sess-1', 'node-a');
    registry.lookup('sess-1');
    registry.lookup('sess-unknown');
    expect(registry.lookup('sess-1')).toBe('node-a');
    expect(registry.lookup('sess-unknown')).toBe(null);
  });
});

describe('SessionBindingRegistry — empty / null / boundary inputs', () => {
  let registry: SessionBindingRegistry;

  beforeEach(() => {
    registry = new SessionBindingRegistry();
  });

  it('rejects empty-string sessionId without mutating state or emitting events', () => {
    const listener = vi.fn();
    registry.onRebindRequest(listener);

    const result = registry.register('', 'node-a');

    expect(result).toBe(null);
    expect(listener).not.toHaveBeenCalled();
    expect(registry.lookup('')).toBe(null);
  });

  it('rejects empty-string nodeId without mutating state or emitting events', () => {
    const listener = vi.fn();
    registry.onRebindRequest(listener);

    const result = registry.register('sess-1', '');

    expect(result).toBe(null);
    expect(listener).not.toHaveBeenCalled();
    expect(registry.lookup('sess-1')).toBe(null);
  });

  it('lookup with empty-string sessionId returns null without throwing', () => {
    expect(() => registry.lookup('')).not.toThrow();
    expect(registry.lookup('')).toBe(null);
  });
});

describe('SessionBindingRegistry — independence between sessions', () => {
  let registry: SessionBindingRegistry;

  beforeEach(() => {
    registry = new SessionBindingRegistry();
  });

  it('registering session A does not affect the binding of session B', () => {
    registry.register('sess-a', 'node-1');
    registry.register('sess-b', 'node-2');

    expect(registry.lookup('sess-a')).toBe('node-1');
    expect(registry.lookup('sess-b')).toBe('node-2');
  });

  it('two sessions can be bound to the same nodeId independently', () => {
    registry.register('sess-a', 'shared-node');
    registry.register('sess-b', 'shared-node');

    expect(registry.lookup('sess-a')).toBe('shared-node');
    expect(registry.lookup('sess-b')).toBe('shared-node');
  });

  it('a rebind on session A does not affect session B', () => {
    registry.register('sess-a', 'node-1');
    registry.register('sess-b', 'node-2');
    registry.register('sess-a', 'node-3');

    expect(registry.pendingRebind('sess-a')).toBe('node-3');
    expect(registry.pendingRebind('sess-b')).toBe(null);
    expect(registry.lookup('sess-b')).toBe('node-2');
  });
});

describe('SessionBindingRegistry — cold start', () => {
  it('a fresh registry has no bindings — no auto-rehydration from disk in PR1', () => {
    const registry = new SessionBindingRegistry();
    expect(registry.lookup('sess-1')).toBe(null);
    expect(registry.pendingRebind('sess-1')).toBe(null);
  });
});

describe('SessionBindingRegistry — listener lifecycle', () => {
  it('the disposer returned by onRebindRequest stops further deliveries', () => {
    const registry = new SessionBindingRegistry();
    const listener = vi.fn();
    const dispose = registry.onRebindRequest(listener);
    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');
    expect(listener).toHaveBeenCalledTimes(1);

    dispose();
    registry.register('sess-1', 'node-c');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
