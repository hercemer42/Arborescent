import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRebindConfirmation } from '../hooks/useRebindConfirmation';
import { usePendingRebindDialogStore } from '../../../../store/pendingRebindDialogStore';
import { storeManager } from '../../../../store/storeManager';
import type { RebindRequestEvent } from '../../../../../shared/types/electronApi';
import { isNodeInReview } from '../../../../store/tree/reviews';
import type { ReviewEntry, ReviewMap } from '../../../../store/tree/reviews';

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
  reviews?: ReviewMap;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let internal: any = {
    nodes: state.nodes ?? {},
    workflowSessionMap: state.workflowSessionMap ?? {},
    reviews: state.reviews ?? {},
    ancestorRegistry: {},
  };
  return {
    getState: () => internal,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setState: (partial: any) => {
      internal = { ...internal, ...partial };
    },
  };
}

function reviewedTerminal(terminalId: string): ReviewEntry {
  return { source: 'terminal', terminalId };
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

describe('useRebindConfirmation — optimistic review cleanup on cancel (US-C)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    usePendingRebindDialogStore.getState().clear();
    vi.spyOn(storeManager, 'getAllStores').mockReturnValue([]);
  });

  it('on cancel, if the newNodeId in the rebind request is in review, removes it from reviews on the file store that owns that node', () => {
    const store = makeStubStore({
      workflowSessionMap: { 'sess-1': 'term-1' },
      reviews: { [NODE_NEW]: reviewedTerminal('term-1') },
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

    expect(isNodeInReview(store.getState().reviews, NODE_NEW)).toBe(false);
  });

  it('on cancel, if reviews is empty or only holds another node, leaves it alone', () => {
    const elsewhere = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
    const store = makeStubStore({
      workflowSessionMap: { 'sess-1': 'term-1' },
      reviews: { [elsewhere]: reviewedTerminal('term-1') },
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

    expect(isNodeInReview(store.getState().reviews, elsewhere)).toBe(true);
    expect(isNodeInReview(store.getState().reviews, NODE_NEW)).toBe(false);
  });

  it('on confirm, the review for newNodeId is preserved (the new binding is now live and the optimistic state is correct)', () => {
    const store = makeStubStore({
      workflowSessionMap: { 'sess-1': 'term-1' },
      reviews: { [NODE_NEW]: reviewedTerminal('term-1') },
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

    expect(isNodeInReview(store.getState().reviews, NODE_NEW)).toBe(true);
  });

  it('on timeout cancel, the same cleanup runs', () => {
    const store = makeStubStore({
      workflowSessionMap: { 'sess-1': 'term-1' },
      reviews: { [NODE_NEW]: reviewedTerminal('term-1') },
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

    expect(isNodeInReview(store.getState().reviews, NODE_NEW)).toBe(false);
  });
});
