import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import { createAckRetryManager } from '../workflowAckManager';

vi.mock('@/store/toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: vi.fn() }) },
}));

vi.mock('@/services/workflowNotification', () => ({
  notifyWorkflowEvent: vi.fn(),
}));

// isAckPending(nodeId) is the predicate the Stop branch consults to tell a node's
// own completion Stop (ack already consumed) from a foreign Stop that landed while
// the node's just-sent prompt is still in flight (ack registered, not yet acked).
// These unit tests pin its semantics in isolation; the end-to-end double-advance
// regression lives in decomposedChildrenAutoAdvance.test.ts.
describe('workflowAckManager — isAckPending predicate', () => {
  let manager: ReturnType<typeof createAckRetryManager>;

  beforeEach(() => {
    // Fake timers so registerPendingAck's retry timer never fires during a test.
    vi.useFakeTimers();
    manager = createAckRetryManager({
      get: () => ({ nodes: {} }),
      sendContentToTerminal: vi.fn(),
      stopWorkflow: vi.fn(),
    });
  });

  afterEach(() => {
    manager.clearAll();
    vi.useRealTimers();
  });

  it('reports not-pending for a node with no registered ack', () => {
    expect(manager.isAckPending('node-x')).toBe(false);
  });

  it('reports pending after registerPendingAck and before the ack arrives', () => {
    manager.registerPendingAck('node-x', 'terminal-1');
    expect(manager.isAckPending('node-x')).toBe(true);
  });

  it('reports not-pending once consumePendingAck consumes the registered ack', () => {
    manager.registerPendingAck('node-x', 'terminal-1');
    manager.consumePendingAck('node-x');
    expect(manager.isAckPending('node-x')).toBe(false);
  });

  it('reports not-pending for a pre-consumed ack, both at consume time and after the suppressed register', () => {
    // The ack can arrive before the autonomousCollaborate promise resolves and
    // registers the pending entry. Such a node is NOT in flight: registerPendingAck
    // sees the pre-consume and skips registration, so isAckPending must read false
    // throughout — a naive pendingAcks.has() would get this wrong.
    manager.consumePendingAck('node-x');
    expect(manager.isAckPending('node-x')).toBe(false);

    manager.registerPendingAck('node-x', 'terminal-1');
    expect(manager.isAckPending('node-x')).toBe(false);
  });

  it('reports not-pending after the entry is cleared via clearPendingAck', () => {
    manager.registerPendingAck('node-x', 'terminal-1');
    manager.clearPendingAck('node-x');
    expect(manager.isAckPending('node-x')).toBe(false);
  });

  it('reports not-pending after clearAll', () => {
    manager.registerPendingAck('node-x', 'terminal-1');
    manager.registerPendingAck('node-y', 'terminal-1');
    manager.clearAll();
    expect(manager.isAckPending('node-x')).toBe(false);
    expect(manager.isAckPending('node-y')).toBe(false);
  });

  it('tracks pending state independently per node', () => {
    manager.registerPendingAck('node-x', 'terminal-1');
    expect(manager.isAckPending('node-x')).toBe(true);
    expect(manager.isAckPending('node-y')).toBe(false);
  });
});
