import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRebindConfirmation } from '../hooks/useRebindConfirmation';
import { usePendingRebindDialogStore } from '../../../../store/pendingRebindDialogStore';
import { useRebindPreflightStore } from '../../../../store/rebindPreflightStore';
import { storeManager } from '../../../../store/storeManager';

function makeStubStore() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let internal: any = {
    nodes: {},
    workflowSessionMap: {},
    collaboratingNodeId: null,
    collaborationSource: null,
    collaboratingTerminalId: null,
  };
  return {
    getState: () => internal,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setState: (partial: any) => {
      internal = { ...internal, ...partial };
    },
  };
}

const NODE_PREV = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const NODE_NEW = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const TERMINAL_ID = 'term-preflight';

describe('useRebindConfirmation — preflight rebind flow (renderer-side gate at send time)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePendingRebindDialogStore.getState().clear();
    useRebindPreflightStore.getState().clear();
    const store = makeStubStore();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(storeManager, 'getAllStores').mockReturnValue([store as any]);
  });

  it('returns pendingRequest="preflight" when a preflight request is queued', () => {
    useRebindPreflightStore.getState().request({
      terminalId: TERMINAL_ID,
      previousNodeId: NODE_PREV,
      newNodeId: NODE_NEW,
      replay: vi.fn(),
    });

    const { result } = renderHook(() => useRebindConfirmation());

    expect(result.current.pendingRequest).toBe('preflight');
  });

  it('on confirm, runs the replay thunk and clears the preflight + pending mark', async () => {
    const replay = vi.fn().mockResolvedValue(undefined);
    usePendingRebindDialogStore.getState().markPending(TERMINAL_ID);
    useRebindPreflightStore.getState().request({
      terminalId: TERMINAL_ID,
      previousNodeId: NODE_PREV,
      newNodeId: NODE_NEW,
      replay,
    });

    const { result } = renderHook(() => useRebindConfirmation());

    await act(async () => {
      const state = result.current;
      if (state.pendingRequest !== null) state.onConfirm();
      await Promise.resolve();
    });

    expect(replay).toHaveBeenCalledTimes(1);
    expect(useRebindPreflightStore.getState().current).toBeNull();
    expect(usePendingRebindDialogStore.getState().isPending(TERMINAL_ID)).toBe(false);
  });

  it('on cancel, does NOT run the replay thunk but still clears state', () => {
    const replay = vi.fn();
    usePendingRebindDialogStore.getState().markPending(TERMINAL_ID);
    useRebindPreflightStore.getState().request({
      terminalId: TERMINAL_ID,
      previousNodeId: NODE_PREV,
      newNodeId: NODE_NEW,
      replay,
    });

    const { result } = renderHook(() => useRebindConfirmation());

    act(() => {
      const state = result.current;
      if (state.pendingRequest !== null) state.onCancel();
    });

    expect(replay).not.toHaveBeenCalled();
    expect(useRebindPreflightStore.getState().current).toBeNull();
    expect(usePendingRebindDialogStore.getState().isPending(TERMINAL_ID)).toBe(false);
  });

  it('session (IPC) requests still take precedence over preflight when both are present', () => {
    useRebindPreflightStore.getState().request({
      terminalId: TERMINAL_ID,
      previousNodeId: NODE_PREV,
      newNodeId: NODE_NEW,
      replay: vi.fn(),
    });

    const onRebindRequestMock = window.electron.onRebindRequest as ReturnType<typeof vi.fn>;
    onRebindRequestMock.mockImplementation((listener: (event: { sessionId: string; previousNodeId: string; newNodeId: string }) => void) => {
      listener({ sessionId: 'sess-1', previousNodeId: NODE_PREV, newNodeId: NODE_NEW });
      return () => {};
    });

    const { result } = renderHook(() => useRebindConfirmation());

    expect(result.current.pendingRequest).toBe('session');
  });

  it('after an IPC session request resolves, a still-queued preflight becomes visible', () => {
    let fireRebindRequest: ((event: { sessionId: string; previousNodeId: string; newNodeId: string }) => void) | null = null;
    const onRebindRequestMock = window.electron.onRebindRequest as ReturnType<typeof vi.fn>;
    onRebindRequestMock.mockImplementation((listener: (event: { sessionId: string; previousNodeId: string; newNodeId: string }) => void) => {
      fireRebindRequest = listener;
      return () => {};
    });

    const { result } = renderHook(() => useRebindConfirmation());

    act(() => {
      fireRebindRequest?.({ sessionId: 'sess-1', previousNodeId: NODE_PREV, newNodeId: NODE_NEW });
    });
    expect(result.current.pendingRequest).toBe('session');

    act(() => {
      useRebindPreflightStore.getState().request({
        terminalId: TERMINAL_ID,
        previousNodeId: NODE_PREV,
        newNodeId: NODE_NEW,
        replay: vi.fn().mockResolvedValue(undefined),
      });
    });
    expect(result.current.pendingRequest).toBe('session');

    act(() => {
      const state = result.current;
      if (state.pendingRequest !== null) state.onConfirm();
    });

    expect(result.current.pendingRequest).toBe('preflight');
  });
});
