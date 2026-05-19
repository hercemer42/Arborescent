import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { mockRegisterSession, mockHandleHookEvent, sessionMapRef, fileStatesRef } = vi.hoisted(() => ({
  mockRegisterSession: vi.fn(),
  mockHandleHookEvent: vi.fn(),
  sessionMapRef: { current: {} as Record<string, string> },
  fileStatesRef: {
    current: {} as Record<string, { terminals: { id: string }[]; activeTerminalId: string | null }>,
  },
}));

vi.mock('../../store/storeManager', () => {
  const fakeStore = {
    getState: () => ({
      currentFilePath: '/files/only.arbo',
      workflowSessionMap: sessionMapRef.current,
      actions: {
        registerSession: mockRegisterSession,
        handleHookEvent: mockHandleHookEvent,
      },
    }),
  };
  return {
    storeManager: {
      getAllStores: vi.fn(() => [fakeStore]),
      getAllStoreEntries: vi.fn(() => [{ filePath: '/files/only.arbo', store: fakeStore }]),
      getStoreForFile: vi.fn(() => fakeStore),
      hasStore: vi.fn(() => true),
    },
  };
});

vi.mock('../../store/terminal/terminalStore', () => ({
  useTerminalStore: {
    getState: () => ({ fileStates: fileStatesRef.current }),
  },
}));

import { useHookEventListener } from '../useHookEventListener';

describe('useHookEventListener', () => {
  let mockCleanup: ReturnType<typeof vi.fn>;
  let hookEventCallback: (event: {
    session_id: string;
    hook_event_name: string;
    terminal_id?: string;
    message?: string;
  }) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    sessionMapRef.current = {};
    fileStatesRef.current = {
      '/files/only.arbo': {
        terminals: [{ id: 'terminal-1' }, { id: 'terminal-42' }],
        activeTerminalId: null,
      },
    };
    mockCleanup = vi.fn();

    global.window = {
      electron: {
        onHookEvent: vi.fn((callback) => {
          hookEventCallback = callback;
          return mockCleanup;
        }),
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  it('should register hook event listener on mount', () => {
    renderHook(() => useHookEventListener());

    expect(window.electron.onHookEvent).toHaveBeenCalledWith(expect.any(Function));
  });

  it('should clean up listener on unmount', () => {
    const { unmount } = renderHook(() => useHookEventListener());

    unmount();

    expect(mockCleanup).toHaveBeenCalled();
  });

  describe('SessionStart events', () => {
    it('should call registerSession with session_id and terminal_id', () => {
      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-abc',
          hook_event_name: 'SessionStart',
          terminal_id: 'terminal-42',
        });
      });

      expect(mockRegisterSession).toHaveBeenCalledWith('sess-abc', 'terminal-42', undefined);
      expect(mockHandleHookEvent).not.toHaveBeenCalled();
    });

    it('should not call registerSession if terminal_id is missing', () => {
      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-abc',
          hook_event_name: 'SessionStart',
        });
      });

      expect(mockRegisterSession).not.toHaveBeenCalled();
    });
  });

  describe('Stop events', () => {
    it('should forward Stop event to handleHookEvent', () => {
      sessionMapRef.current = { 'sess-abc': 'terminal-1' };
      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-abc',
          hook_event_name: 'Stop',
        });
      });

      expect(mockHandleHookEvent).toHaveBeenCalledWith({
        session_id: 'sess-abc',
        hook_event_name: 'Stop',
      });
      expect(mockRegisterSession).not.toHaveBeenCalled();
    });
  });

  describe('Notification events', () => {
    it('should forward Notification event with message to handleHookEvent', () => {
      sessionMapRef.current = { 'sess-abc': 'terminal-1' };
      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-abc',
          hook_event_name: 'Notification',
          message: 'Something went wrong',
        });
      });

      expect(mockHandleHookEvent).toHaveBeenCalledWith({
        session_id: 'sess-abc',
        hook_event_name: 'Notification',
        message: 'Something went wrong',
      });
    });
  });

  describe('unknown events', () => {
    it('should forward unknown event types to handleHookEvent without crashing', () => {
      sessionMapRef.current = { 'sess-abc': 'terminal-1' };
      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-abc',
          hook_event_name: 'UnknownFutureEvent',
        });
      });

      expect(mockHandleHookEvent).toHaveBeenCalledWith({
        session_id: 'sess-abc',
        hook_event_name: 'UnknownFutureEvent',
      });
    });
  });

  describe('rapid events', () => {
    it('should handle multiple events in quick succession', () => {
      mockRegisterSession.mockImplementation((sessionId: string, terminalId: string) => {
        sessionMapRef.current = { ...sessionMapRef.current, [sessionId]: terminalId };
      });
      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-1',
          hook_event_name: 'SessionStart',
          terminal_id: 'terminal-1',
        });
        hookEventCallback({
          session_id: 'sess-1',
          hook_event_name: 'Stop',
        });
        hookEventCallback({
          session_id: 'sess-2',
          hook_event_name: 'SessionStart',
          terminal_id: 'terminal-1',
        });
      });

      expect(mockRegisterSession).toHaveBeenCalledTimes(2);
      expect(mockHandleHookEvent).toHaveBeenCalledTimes(1);
    });
  });

  describe('session restart in same terminal', () => {
    it('should call registerSession again for new session on same terminal', () => {
      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-old',
          hook_event_name: 'SessionStart',
          terminal_id: 'terminal-1',
        });
      });

      act(() => {
        hookEventCallback({
          session_id: 'sess-new',
          hook_event_name: 'SessionStart',
          terminal_id: 'terminal-1',
        });
      });

      expect(mockRegisterSession).toHaveBeenCalledTimes(2);
      expect(mockRegisterSession).toHaveBeenCalledWith('sess-old', 'terminal-1', undefined);
      expect(mockRegisterSession).toHaveBeenCalledWith('sess-new', 'terminal-1', undefined);
    });
  });

  describe('session-terminal-mapping events (US-E)', () => {
    // Emitted by the dispatcher for every register-binding that carries a
    // terminal_id. Keeps workflowSessionMap accurate in real time on prompts
    // that come from a session Arborescent did not itself spawn.
    it('calls registerSession with session_id and terminal_id on session-terminal-mapping', () => {
      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-mapped',
          hook_event_name: 'session-terminal-mapping',
          terminal_id: 'terminal-42',
        });
      });

      expect(mockRegisterSession).toHaveBeenCalledWith('sess-mapped', 'terminal-42', undefined);
      expect(mockHandleHookEvent).not.toHaveBeenCalled();
    });

    it('drops the event when terminal_id is missing — nothing to map', () => {
      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-orphan',
          hook_event_name: 'session-terminal-mapping',
        });
      });

      expect(mockRegisterSession).not.toHaveBeenCalled();
      expect(mockHandleHookEvent).not.toHaveBeenCalled();
    });

    it('drops the event when no open file owns that terminal (cannot route)', () => {
      fileStatesRef.current = { '/files/only.arbo': { terminals: [], activeTerminalId: null } };
      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-mapped',
          hook_event_name: 'session-terminal-mapping',
          terminal_id: 'terminal-unknown',
        });
      });

      expect(mockRegisterSession).not.toHaveBeenCalled();
    });

    it('does NOT call handleHookEvent for session-terminal-mapping — it is a sync-only event, not part of the workflow hook pipeline', () => {
      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-mapped',
          hook_event_name: 'session-terminal-mapping',
          terminal_id: 'terminal-42',
        });
      });

      expect(mockHandleHookEvent).not.toHaveBeenCalled();
    });

    it('re-asserts the same session→terminal mapping on a repeat event — registerSession is the canonical setter that handles the no-op case', () => {
      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-1',
          hook_event_name: 'session-terminal-mapping',
          terminal_id: 'terminal-1',
        });
        hookEventCallback({
          session_id: 'sess-1',
          hook_event_name: 'session-terminal-mapping',
          terminal_id: 'terminal-1',
        });
      });

      expect(mockRegisterSession).toHaveBeenCalledTimes(2);
    });
  });
});
