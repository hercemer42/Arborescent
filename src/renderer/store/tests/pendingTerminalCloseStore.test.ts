import { describe, it, expect, beforeEach, vi } from 'vitest';
import { usePendingTerminalCloseStore } from '../pendingTerminalCloseStore';

// Single-slot store: only one terminal-close confirmation can be pending at
// a time (the dialog is modal). A second request while one is already
// pending should not silently overwrite the first — concurrent close
// attempts on different terminals are a UX edge that the modal already
// blocks visually, but the store must not corrupt the existing onConfirm /
// onCancel callbacks of the in-flight request.

describe('pendingTerminalCloseStore', () => {
  beforeEach(() => {
    usePendingTerminalCloseStore.getState().clear();
  });

  it('starts with no pending request', () => {
    expect(usePendingTerminalCloseStore.getState().current).toBeNull();
  });

  it('requestClose stores the terminal id, title, and confirm/cancel callbacks', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    usePendingTerminalCloseStore.getState().requestClose({
      terminalId: 'term-1',
      terminalTitle: 'Terminal 1',
      onConfirm,
      onCancel,
    });
    const current = usePendingTerminalCloseStore.getState().current;
    expect(current?.terminalId).toBe('term-1');
    expect(current?.terminalTitle).toBe('Terminal 1');
    expect(current?.onConfirm).toBe(onConfirm);
    expect(current?.onCancel).toBe(onCancel);
  });

  it('clear() drops the pending request', () => {
    usePendingTerminalCloseStore.getState().requestClose({
      terminalId: 'term-1',
      terminalTitle: 'Terminal 1',
      onConfirm: vi.fn(),
      onCancel: vi.fn(),
    });
    usePendingTerminalCloseStore.getState().clear();
    expect(usePendingTerminalCloseStore.getState().current).toBeNull();
  });

  it.todo('a second requestClose while one is already pending is rejected — the first remains the authoritative request');
});
