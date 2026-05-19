import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRebindConfirmation } from '../hooks/useRebindConfirmation';
import { usePendingRebindDialogStore } from '../../../../store/pendingRebindDialogStore';
import { storeManager } from '../../../../store/storeManager';
import type { RebindRequestEvent } from '../../../../../shared/types/electronApi';

type RebindRequestListener = (event: RebindRequestEvent) => void;
type RebindCancelledListener = (sessionId: string) => void;

function captureCallbacks() {
  const onRebindRequestMock = window.electron.onRebindRequest as ReturnType<typeof vi.fn>;
  const onRebindCancelledMock = window.electron.onRebindCancelled as ReturnType<typeof vi.fn>;
  let requestListener: RebindRequestListener = () => {};
  let cancelledListener: RebindCancelledListener = () => {};
  onRebindRequestMock.mockImplementation((listener: RebindRequestListener) => {
    requestListener = listener;
    return () => {};
  });
  onRebindCancelledMock.mockImplementation((listener: RebindCancelledListener) => {
    cancelledListener = listener;
    return () => {};
  });
  return {
    fireRebindRequest: (event: RebindRequestEvent) => requestListener(event),
    fireRebindCancelled: (sessionId: string) => cancelledListener(sessionId),
  };
}

function makeStubStore(state: {
  nodes?: Record<string, { id: string; content: string; children: string[]; metadata: Record<string, unknown> }>;
  workflowSessionMap?: Record<string, string>;
  collaboratingNodeId?: string | null;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let internal: any = {
    nodes: state.nodes ?? {},
    workflowSessionMap: state.workflowSessionMap ?? {},
    collaboratingNodeId: state.collaboratingNodeId ?? null,
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

const NODE_OLD = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const NODE_NEW = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';

describe('useRebindConfirmation — per-terminal pending state on receive (US-C)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePendingRebindDialogStore.getState().clear();
    vi.spyOn(storeManager, 'getAllStores').mockReturnValue([]);
  });

  it('on receiving REBIND_REQUEST_CHANNEL, marks the rebind pending for the terminal mapped to that session in workflowSessionMap', () => {
    const store = makeStubStore({ workflowSessionMap: { 'sess-1': 'term-1' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(storeManager, 'getAllStores').mockReturnValue([store as any]);
    const callbacks = captureCallbacks();

    renderHook(() => useRebindConfirmation());
    act(() => {
      callbacks.fireRebindRequest({ sessionId: 'sess-1', previousNodeId: NODE_OLD, newNodeId: NODE_NEW });
    });

    expect(usePendingRebindDialogStore.getState().isPending('term-1')).toBe(true);
  });

  it('on confirm, clears the pending entry for that terminal', () => {
    const store = makeStubStore({ workflowSessionMap: { 'sess-1': 'term-1' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(storeManager, 'getAllStores').mockReturnValue([store as any]);
    const callbacks = captureCallbacks();

    const { result } = renderHook(() => useRebindConfirmation());
    act(() => {
      callbacks.fireRebindRequest({ sessionId: 'sess-1', previousNodeId: NODE_OLD, newNodeId: NODE_NEW });
    });
    expect(usePendingRebindDialogStore.getState().isPending('term-1')).toBe(true);

    act(() => {
      const state = result.current;
      if (state.pendingRequest !== null) state.onConfirm();
    });

    expect(usePendingRebindDialogStore.getState().isPending('term-1')).toBe(false);
  });

  it('on cancel, clears the pending entry for that terminal', () => {
    const store = makeStubStore({ workflowSessionMap: { 'sess-1': 'term-1' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(storeManager, 'getAllStores').mockReturnValue([store as any]);
    const callbacks = captureCallbacks();

    const { result } = renderHook(() => useRebindConfirmation());
    act(() => {
      callbacks.fireRebindRequest({ sessionId: 'sess-1', previousNodeId: NODE_OLD, newNodeId: NODE_NEW });
    });

    act(() => {
      const state = result.current;
      if (state.pendingRequest !== null) state.onCancel();
    });

    expect(usePendingRebindDialogStore.getState().isPending('term-1')).toBe(false);
  });

  it('on REBIND_CANCELLED_CHANNEL (timeout), clears the pending entry for that terminal', () => {
    const store = makeStubStore({ workflowSessionMap: { 'sess-1': 'term-1' } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(storeManager, 'getAllStores').mockReturnValue([store as any]);
    const callbacks = captureCallbacks();

    renderHook(() => useRebindConfirmation());
    act(() => {
      callbacks.fireRebindRequest({ sessionId: 'sess-1', previousNodeId: NODE_OLD, newNodeId: NODE_NEW });
    });

    act(() => {
      callbacks.fireRebindCancelled('sess-1');
    });

    expect(usePendingRebindDialogStore.getState().isPending('term-1')).toBe(false);
  });

  it('if no terminal is mapped to the session in workflowSessionMap, no pending entry is created (no terminal to gate)', () => {
    // Empty store → no terminal mapped for sess-1.
    const store = makeStubStore({ workflowSessionMap: {} });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(storeManager, 'getAllStores').mockReturnValue([store as any]);
    const callbacks = captureCallbacks();

    renderHook(() => useRebindConfirmation());
    act(() => {
      callbacks.fireRebindRequest({ sessionId: 'sess-1', previousNodeId: NODE_OLD, newNodeId: NODE_NEW });
    });

    expect(usePendingRebindDialogStore.getState().pendingTerminalIds.size).toBe(0);
  });
});

describe('useRebindConfirmation — optimistic collaboratingNodeId cleanup on cancel (US-C)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePendingRebindDialogStore.getState().clear();
    vi.spyOn(storeManager, 'getAllStores').mockReturnValue([]);
  });

  it('on cancel, if collaboratingNodeId equals the newNodeId in the rebind request, clears it on the file store that owns that node', () => {
    const store = makeStubStore({
      workflowSessionMap: { 'sess-1': 'term-1' },
      collaboratingNodeId: NODE_NEW,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(storeManager, 'getAllStores').mockReturnValue([store as any]);
    const callbacks = captureCallbacks();

    const { result } = renderHook(() => useRebindConfirmation());
    act(() => {
      callbacks.fireRebindRequest({ sessionId: 'sess-1', previousNodeId: NODE_OLD, newNodeId: NODE_NEW });
    });
    act(() => {
      const state = result.current;
      if (state.pendingRequest !== null) state.onCancel();
    });

    expect(store.getState().collaboratingNodeId).toBe(null);
  });

  it('on cancel, if collaboratingNodeId is null or points elsewhere, leaves it alone', () => {
    const elsewhere = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
    const store = makeStubStore({
      workflowSessionMap: { 'sess-1': 'term-1' },
      collaboratingNodeId: elsewhere,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(storeManager, 'getAllStores').mockReturnValue([store as any]);
    const callbacks = captureCallbacks();

    const { result } = renderHook(() => useRebindConfirmation());
    act(() => {
      callbacks.fireRebindRequest({ sessionId: 'sess-1', previousNodeId: NODE_OLD, newNodeId: NODE_NEW });
    });
    act(() => {
      const state = result.current;
      if (state.pendingRequest !== null) state.onCancel();
    });

    expect(store.getState().collaboratingNodeId).toBe(elsewhere);
  });

  it('on confirm, collaboratingNodeId is preserved (the new binding is now live and the optimistic state is correct)', () => {
    const store = makeStubStore({
      workflowSessionMap: { 'sess-1': 'term-1' },
      collaboratingNodeId: NODE_NEW,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(storeManager, 'getAllStores').mockReturnValue([store as any]);
    const callbacks = captureCallbacks();

    const { result } = renderHook(() => useRebindConfirmation());
    act(() => {
      callbacks.fireRebindRequest({ sessionId: 'sess-1', previousNodeId: NODE_OLD, newNodeId: NODE_NEW });
    });
    act(() => {
      const state = result.current;
      if (state.pendingRequest !== null) state.onConfirm();
    });

    expect(store.getState().collaboratingNodeId).toBe(NODE_NEW);
  });

  it('on timeout cancel, the same cleanup runs', () => {
    const store = makeStubStore({
      workflowSessionMap: { 'sess-1': 'term-1' },
      collaboratingNodeId: NODE_NEW,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    vi.spyOn(storeManager, 'getAllStores').mockReturnValue([store as any]);
    const callbacks = captureCallbacks();

    renderHook(() => useRebindConfirmation());
    act(() => {
      callbacks.fireRebindRequest({ sessionId: 'sess-1', previousNodeId: NODE_OLD, newNodeId: NODE_NEW });
    });
    act(() => {
      callbacks.fireRebindCancelled('sess-1');
    });

    expect(store.getState().collaboratingNodeId).toBe(null);
  });
});
