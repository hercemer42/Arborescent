import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import { createRebindIpcBridge, RebindIpcBridge } from '../rebindIpcBridge';

const REBIND_REQUEST_CHANNEL = 'mcp:rebind-request';

type Decision = { sessionId: string; confirmed: boolean };
type DecisionHandler = (decision: Decision) => void;

function makeFakeDecisionChannel(): {
  onDecision: (handler: DecisionHandler) => () => void;
  sendDecision: (decision: Decision) => void;
} {
  const handlers = new Set<DecisionHandler>();
  return {
    onDecision: (handler) => {
      handlers.add(handler);
      return () => handlers.delete(handler);
    },
    sendDecision: (decision) => {
      for (const handler of handlers) handler(decision);
    },
  };
}

describe('createRebindIpcBridge — emits rebind-request to renderer', () => {
  let registry: SessionBindingRegistry;
  let sendToRenderer: ReturnType<typeof vi.fn>;
  let notifyRendererCancelled: ReturnType<typeof vi.fn>;
  let channel: ReturnType<typeof makeFakeDecisionChannel>;
  let bridge: RebindIpcBridge;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new SessionBindingRegistry();
    sendToRenderer = vi.fn();
    notifyRendererCancelled = vi.fn();
    channel = makeFakeDecisionChannel();
    bridge = createRebindIpcBridge({
      registry,
      sendToRenderer,
      notifyRendererCancelled,
      onRendererDecision: channel.onDecision,
      timeoutMs: 30_000,
    });
  });

  afterEach(() => {
    bridge.dispose();
    vi.useRealTimers();
  });

  it('forwards a rebind-request to the renderer when the registry emits one', () => {
    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');

    expect(sendToRenderer).toHaveBeenCalledTimes(1);
    expect(sendToRenderer).toHaveBeenCalledWith(REBIND_REQUEST_CHANNEL, {
      sessionId: 'sess-1',
      previousNodeId: 'node-a',
      newNodeId: 'node-b',
    });
  });

  it('does NOT forward when the same session re-registers the same node (no-op)', () => {
    registry.register('sess-1', 'node-a');
    sendToRenderer.mockClear();

    registry.register('sess-1', 'node-a');

    expect(sendToRenderer).not.toHaveBeenCalled();
  });

  it('does NOT forward on a first-time bind (set, not rebind)', () => {
    registry.register('sess-1', 'node-a');

    expect(sendToRenderer).not.toHaveBeenCalled();
  });

  it('does NOT forward a duplicate rebind-request when the same pending pair is re-registered', () => {
    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');
    sendToRenderer.mockClear();

    registry.register('sess-1', 'node-b');

    expect(sendToRenderer).not.toHaveBeenCalled();
  });
});

describe('createRebindIpcBridge — applies renderer decisions to the registry', () => {
  let registry: SessionBindingRegistry;
  let sendToRenderer: ReturnType<typeof vi.fn>;
  let notifyRendererCancelled: ReturnType<typeof vi.fn>;
  let channel: ReturnType<typeof makeFakeDecisionChannel>;
  let bridge: RebindIpcBridge;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new SessionBindingRegistry();
    sendToRenderer = vi.fn();
    notifyRendererCancelled = vi.fn();
    channel = makeFakeDecisionChannel();
    bridge = createRebindIpcBridge({
      registry,
      sendToRenderer,
      notifyRendererCancelled,
      onRendererDecision: channel.onDecision,
      timeoutMs: 30_000,
    });
  });

  afterEach(() => {
    bridge.dispose();
    vi.useRealTimers();
  });

  it('confirm decision applies the new binding', () => {
    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');

    channel.sendDecision({ sessionId: 'sess-1', confirmed: true });

    expect(registry.lookup('sess-1')).toBe('node-b');
    expect(registry.pendingRebind('sess-1')).toBe(null);
  });

  it('cancel decision preserves the prior binding and drops the pending', () => {
    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');

    channel.sendDecision({ sessionId: 'sess-1', confirmed: false });

    expect(registry.lookup('sess-1')).toBe('node-a');
    expect(registry.pendingRebind('sess-1')).toBe(null);
  });

  it('decision for an unknown session is a no-op (no throw)', () => {
    expect(() => {
      channel.sendDecision({ sessionId: 'sess-never-seen', confirmed: true });
    }).not.toThrow();
    expect(registry.lookup('sess-never-seen')).toBe(null);
  });

  it('a confirm or cancel from the renderer does NOT emit a cancellation notification (renderer already closed its own dialog)', () => {
    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');

    channel.sendDecision({ sessionId: 'sess-1', confirmed: false });

    expect(notifyRendererCancelled).not.toHaveBeenCalled();
  });
});

describe('createRebindIpcBridge — timeout defaults to cancel', () => {
  let registry: SessionBindingRegistry;
  let sendToRenderer: ReturnType<typeof vi.fn>;
  let notifyRendererCancelled: ReturnType<typeof vi.fn>;
  let channel: ReturnType<typeof makeFakeDecisionChannel>;
  let bridge: RebindIpcBridge;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new SessionBindingRegistry();
    sendToRenderer = vi.fn();
    notifyRendererCancelled = vi.fn();
    channel = makeFakeDecisionChannel();
    bridge = createRebindIpcBridge({
      registry,
      sendToRenderer,
      notifyRendererCancelled,
      onRendererDecision: channel.onDecision,
      timeoutMs: 1000,
    });
  });

  afterEach(() => {
    bridge.dispose();
    vi.useRealTimers();
  });

  it('after the configured timeout with no decision, the prior binding is preserved', () => {
    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');
    expect(registry.pendingRebind('sess-1')).toBe('node-b');

    vi.advanceTimersByTime(1000);

    expect(registry.lookup('sess-1')).toBe('node-a');
    expect(registry.pendingRebind('sess-1')).toBe(null);
  });

  it('after the configured timeout, the renderer is told to close its open dialog via the cancellation channel', () => {
    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');

    vi.advanceTimersByTime(1000);

    expect(notifyRendererCancelled).toHaveBeenCalledTimes(1);
    expect(notifyRendererCancelled).toHaveBeenCalledWith('sess-1');
  });

  it('a confirm arriving BEFORE the timeout still applies, and the timer does not later overwrite it', () => {
    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');

    vi.advanceTimersByTime(500);
    channel.sendDecision({ sessionId: 'sess-1', confirmed: true });

    expect(registry.lookup('sess-1')).toBe('node-b');

    vi.advanceTimersByTime(10_000);

    expect(registry.lookup('sess-1')).toBe('node-b');
    expect(notifyRendererCancelled).not.toHaveBeenCalled();
  });

  it('a cancel arriving before the timeout does not double-cancel a subsequent rebind on the same session', () => {
    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');
    channel.sendDecision({ sessionId: 'sess-1', confirmed: false });

    registry.register('sess-1', 'node-c');
    expect(sendToRenderer).toHaveBeenLastCalledWith(REBIND_REQUEST_CHANNEL, {
      sessionId: 'sess-1',
      previousNodeId: 'node-a',
      newNodeId: 'node-c',
    });

    vi.advanceTimersByTime(2000);
    expect(registry.lookup('sess-1')).toBe('node-a');
    expect(notifyRendererCancelled).toHaveBeenCalledWith('sess-1');
  });
});

describe('createRebindIpcBridge — dispose stops forwarding', () => {
  it('dispose unsubscribes from the registry so further rebinds do not reach the renderer', () => {
    vi.useFakeTimers();
    const registry = new SessionBindingRegistry();
    const sendToRenderer = vi.fn();
    const notifyRendererCancelled = vi.fn();
    const channel = makeFakeDecisionChannel();
    const bridge = createRebindIpcBridge({
      registry,
      sendToRenderer,
      notifyRendererCancelled,
      onRendererDecision: channel.onDecision,
      timeoutMs: 1000,
    });

    bridge.dispose();
    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');

    expect(sendToRenderer).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('dispose stops listening for renderer decisions', () => {
    vi.useFakeTimers();
    const registry = new SessionBindingRegistry();
    const sendToRenderer = vi.fn();
    const notifyRendererCancelled = vi.fn();
    const channel = makeFakeDecisionChannel();
    const bridge = createRebindIpcBridge({
      registry,
      sendToRenderer,
      notifyRendererCancelled,
      onRendererDecision: channel.onDecision,
      timeoutMs: 1000,
    });

    registry.register('sess-1', 'node-a');
    registry.register('sess-1', 'node-b');
    bridge.dispose();

    channel.sendDecision({ sessionId: 'sess-1', confirmed: true });

    expect(registry.lookup('sess-1')).toBe('node-a');
    expect(registry.pendingRebind('sess-1')).toBe('node-b');
    vi.useRealTimers();
  });
});
