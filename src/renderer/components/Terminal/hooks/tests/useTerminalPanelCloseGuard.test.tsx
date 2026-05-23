import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useTerminalPanel } from '../useTerminalPanel';
import { useTerminalStore } from '../../../../store/terminal/terminalStore';
import { usePendingTerminalCloseStore } from '../../../../store/pendingTerminalCloseStore';

// The close-guard sits in handleCloseTerminal. If isTerminalProcessing(id)
// returns true, the helper must NOT call closeTerminal directly — it must
// publish a pending-close request that the renderer-level container picks up
// and renders as the confirmation dialog. Confirm runs the real close;
// cancel leaves the terminal alone.

vi.mock('../../../../store/terminal/terminalStore');

const { mockHandleTerminalClosed } = vi.hoisted(() => ({
  mockHandleTerminalClosed: vi.fn(),
}));

vi.mock('../../../../store/storeManager', () => ({
  storeManager: {
    getAllStores: vi.fn(() => [{
      getState: () => ({
        actions: {
          handleTerminalClosed: mockHandleTerminalClosed,
        },
      }),
    }]),
  },
}));

describe('useTerminalPanel.handleCloseTerminal — close guard', () => {
  const mockCloseTerminal = vi.fn();
  const mockCreateNewTerminal = vi.fn();
  let processingState: Record<string, boolean> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    processingState = {};
    usePendingTerminalCloseStore.getState().clear();
  });

  function setupTerminalStoreMock(terminals: { id: string; title: string }[]) {
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: Record<string, unknown>) => unknown) => {
        const state = {
          terminals,
          createNewTerminal: mockCreateNewTerminal,
          closeTerminal: mockCloseTerminal,
          isTerminalProcessing: (id: string) => Boolean(processingState[id]),
        };
        return selector(state);
      },
    );
    // Hook also reads via getState() for non-subscribed lookups
    (useTerminalStore as unknown as { getState: () => unknown }).getState = () => ({
      terminals,
      fileStates: {},
      isTerminalProcessing: (id: string) => Boolean(processingState[id]),
      closeTerminal: mockCloseTerminal,
    });
  }

  it('idle terminal: closes directly without opening a dialog', async () => {
    setupTerminalStoreMock([{ id: 'term-1', title: 'Terminal 1' }]);
    mockCloseTerminal.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTerminalPanel());

    await act(async () => {
      await result.current.handleCloseTerminal('term-1');
    });

    expect(mockCloseTerminal).toHaveBeenCalledWith('term-1');
    expect(usePendingTerminalCloseStore.getState().current).toBeNull();
  });

  it('bound-to-a-node terminal that is not processing: closes directly with no dialog (binding does not gate the guard)', async () => {
    // The guard reads isTerminalProcessing only — origin binding is irrelevant.
    setupTerminalStoreMock([{ id: 'term-1', title: 'Terminal 1', originNodeId: 'node-7' } as { id: string; title: string }]);
    mockCloseTerminal.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTerminalPanel());

    await act(async () => {
      await result.current.handleCloseTerminal('term-1');
    });

    expect(mockCloseTerminal).toHaveBeenCalledWith('term-1');
    expect(usePendingTerminalCloseStore.getState().current).toBeNull();
  });

  it('processing terminal: publishes a pending-close request and does NOT close yet', async () => {
    processingState['term-1'] = true;
    setupTerminalStoreMock([{ id: 'term-1', title: 'Terminal 1' }]);

    const { result } = renderHook(() => useTerminalPanel());

    await act(async () => {
      await result.current.handleCloseTerminal('term-1');
    });

    expect(mockCloseTerminal).not.toHaveBeenCalled();
    const pending = usePendingTerminalCloseStore.getState().current;
    expect(pending).not.toBeNull();
    expect(pending?.terminalId).toBe('term-1');
    expect(typeof pending?.onConfirm).toBe('function');
    expect(typeof pending?.onCancel).toBe('function');
  });

  it('processing terminal: the pending-close request carries the terminal title for the dialog copy', async () => {
    processingState['term-1'] = true;
    setupTerminalStoreMock([{ id: 'term-1', title: 'Claude — refactor pass' }]);

    const { result } = renderHook(() => useTerminalPanel());

    await act(async () => {
      await result.current.handleCloseTerminal('term-1');
    });

    expect(usePendingTerminalCloseStore.getState().current?.terminalTitle).toBe('Claude — refactor pass');
  });

  it('confirming the pending request performs the real close and broadcasts to tree stores', async () => {
    processingState['term-1'] = true;
    setupTerminalStoreMock([{ id: 'term-1', title: 'Terminal 1' }]);
    mockCloseTerminal.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTerminalPanel());

    await act(async () => {
      await result.current.handleCloseTerminal('term-1');
    });

    const pending = usePendingTerminalCloseStore.getState().current;
    expect(pending).not.toBeNull();

    await act(async () => {
      await pending!.onConfirm();
    });

    await waitFor(() => {
      expect(mockCloseTerminal).toHaveBeenCalledWith('term-1');
      expect(mockHandleTerminalClosed).toHaveBeenCalledWith('term-1');
    });
    expect(usePendingTerminalCloseStore.getState().current).toBeNull();
  });

  it('cancelling the pending request leaves the terminal untouched and clears the request', async () => {
    processingState['term-1'] = true;
    setupTerminalStoreMock([{ id: 'term-1', title: 'Terminal 1' }]);

    const { result } = renderHook(() => useTerminalPanel());

    await act(async () => {
      await result.current.handleCloseTerminal('term-1');
    });

    const pending = usePendingTerminalCloseStore.getState().current;

    act(() => {
      pending!.onCancel();
    });

    expect(mockCloseTerminal).not.toHaveBeenCalled();
    expect(mockHandleTerminalClosed).not.toHaveBeenCalled();
    expect(usePendingTerminalCloseStore.getState().current).toBeNull();
  });

  it('closing a terminal with no active session (unknown id) closes immediately without a dialog', async () => {
    // No entry in terminals list, no processing flag — treated as idle.
    setupTerminalStoreMock([]);
    mockCloseTerminal.mockResolvedValue(undefined);

    const { result } = renderHook(() => useTerminalPanel());

    await act(async () => {
      await result.current.handleCloseTerminal('phantom-id');
    });

    expect(mockCloseTerminal).toHaveBeenCalledWith('phantom-id');
    expect(usePendingTerminalCloseStore.getState().current).toBeNull();
  });
});
