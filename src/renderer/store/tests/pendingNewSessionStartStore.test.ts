import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePendingNewSessionStartStore } from '../pendingNewSessionStartStore';

describe('pendingNewSessionStartStore', () => {
  beforeEach(() => {
    usePendingNewSessionStartStore.setState({ current: null });
  });

  it('holds a single pending request', () => {
    const request = { nodeId: 'n1', onConfirm: vi.fn(), onCancel: vi.fn() };
    usePendingNewSessionStartStore.getState().request(request);
    expect(usePendingNewSessionStartStore.getState().current).toBe(request);
  });

  it('ignores a second request while one is already pending', () => {
    const first = { nodeId: 'n1', onConfirm: vi.fn(), onCancel: vi.fn() };
    const second = { nodeId: 'n2', onConfirm: vi.fn(), onCancel: vi.fn() };
    usePendingNewSessionStartStore.getState().request(first);
    usePendingNewSessionStartStore.getState().request(second);
    expect(usePendingNewSessionStartStore.getState().current).toBe(first);
  });

  it('clear removes the pending request', () => {
    usePendingNewSessionStartStore.getState().request({ nodeId: 'n1', onConfirm: vi.fn(), onCancel: vi.fn() });
    usePendingNewSessionStartStore.getState().clear();
    expect(usePendingNewSessionStartStore.getState().current).toBeNull();
  });
});
