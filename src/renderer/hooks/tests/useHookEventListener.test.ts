import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const { mockRegisterSession, mockHandleHookEvent } = vi.hoisted(() => ({
  mockRegisterSession: vi.fn(),
  mockHandleHookEvent: vi.fn(),
}));

vi.mock('../../store/storeManager', () => ({
  storeManager: {
    getAllStores: vi.fn(() => [{
      getState: () => ({
        actions: {
          registerSession: mockRegisterSession,
          handleHookEvent: mockHandleHookEvent,
        },
      }),
    }]),
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

      expect(mockRegisterSession).toHaveBeenCalledWith('sess-abc', 'terminal-42');
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
      expect(mockRegisterSession).toHaveBeenCalledWith('sess-old', 'terminal-1');
      expect(mockRegisterSession).toHaveBeenCalledWith('sess-new', 'terminal-1');
    });
  });
});
