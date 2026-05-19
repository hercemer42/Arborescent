import { describe, it, expect, beforeEach } from 'vitest';
import { usePendingRebindDialogStore } from '../pendingRebindDialogStore';

describe('pendingRebindDialogStore — terminal-keyed pending state (US-C)', () => {
  beforeEach(() => {
    usePendingRebindDialogStore.getState().clear();
  });

  it('isPending returns false for an untracked terminal', () => {
    expect(usePendingRebindDialogStore.getState().isPending('term-1')).toBe(false);
  });

  it('markPending makes isPending true for that terminal only', () => {
    usePendingRebindDialogStore.getState().markPending('term-1');
    expect(usePendingRebindDialogStore.getState().isPending('term-1')).toBe(true);
    expect(usePendingRebindDialogStore.getState().isPending('term-2')).toBe(false);
  });

  it('clearPending removes the entry for the given terminal', () => {
    usePendingRebindDialogStore.getState().markPending('term-1');
    usePendingRebindDialogStore.getState().clearPending('term-1');
    expect(usePendingRebindDialogStore.getState().isPending('term-1')).toBe(false);
  });

  it('clearPending on an untracked terminal is a silent no-op', () => {
    expect(() => usePendingRebindDialogStore.getState().clearPending('term-unknown')).not.toThrow();
    expect(usePendingRebindDialogStore.getState().isPending('term-unknown')).toBe(false);
  });

  it('markPending the same terminal twice is idempotent', () => {
    usePendingRebindDialogStore.getState().markPending('term-1');
    usePendingRebindDialogStore.getState().markPending('term-1');
    expect(usePendingRebindDialogStore.getState().isPending('term-1')).toBe(true);
    usePendingRebindDialogStore.getState().clearPending('term-1');
    expect(usePendingRebindDialogStore.getState().isPending('term-1')).toBe(false);
  });

  it('multiple terminals can be pending concurrently', () => {
    usePendingRebindDialogStore.getState().markPending('term-1');
    usePendingRebindDialogStore.getState().markPending('term-2');
    expect(usePendingRebindDialogStore.getState().isPending('term-1')).toBe(true);
    expect(usePendingRebindDialogStore.getState().isPending('term-2')).toBe(true);
    usePendingRebindDialogStore.getState().clearPending('term-1');
    expect(usePendingRebindDialogStore.getState().isPending('term-1')).toBe(false);
    expect(usePendingRebindDialogStore.getState().isPending('term-2')).toBe(true);
  });

  it('clear() drops every pending entry', () => {
    usePendingRebindDialogStore.getState().markPending('term-1');
    usePendingRebindDialogStore.getState().markPending('term-2');
    usePendingRebindDialogStore.getState().clear();
    expect(usePendingRebindDialogStore.getState().isPending('term-1')).toBe(false);
    expect(usePendingRebindDialogStore.getState().isPending('term-2')).toBe(false);
  });

  it('an empty-string terminalId is treated defensively — markPending is a no-op', () => {
    usePendingRebindDialogStore.getState().markPending('');
    expect(usePendingRebindDialogStore.getState().isPending('')).toBe(false);
  });
});
