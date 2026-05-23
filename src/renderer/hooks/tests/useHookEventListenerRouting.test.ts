import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// These tests pin the desired routing behavior for hook events:
//
//   Hook events (SessionStart / Stop / NeedsReview / Notification /
//   UserPromptSubmit) MUST be delivered to the single store that owns
//   the relevant terminal_id (for SessionStart) or session_id (for the
//   others).
//
//   The current implementation broadcasts every event to every store
//   via storeManager.getAllStores(). That causes the three symptoms
//   described in PR1's user story:
//     - cross-store "terminal already assigned" false positive
//     - duplicate commands re-sent to the terminal (e.g. when
//       SessionStart source='clear' arrives, every store independently
//       re-issues the gated prompt for its own running node)
//     - cross-store session-map corruption that makes
//       continueWorkflow think the original terminal is now "assigned
//       to another"
//
// We don't constrain HOW routing is implemented (could route by
// terminal_id via terminalStore.fileStates, could route by session_id
// via each store's workflowSessionMap). We just pin the observable
// outcome: only the owning store's actions are called.

interface FakeStoreEntry {
  filePath: string;
  registeredSessionIds: Set<string>;
  registerSession: ReturnType<typeof vi.fn>;
  handleHookEvent: ReturnType<typeof vi.fn>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: { getState: () => any };
}

function makeStore(
  filePath: string,
  opts: { registeredSessionIds?: string[] } = {},
): FakeStoreEntry {
  const registeredSessionIds = new Set(opts.registeredSessionIds ?? []);
  const registerSession = vi.fn((sessionId: string) => {
    registeredSessionIds.add(sessionId);
  });
  const handleHookEvent = vi.fn();

  const entry: FakeStoreEntry = {
    filePath,
    registeredSessionIds,
    registerSession,
    handleHookEvent,
    store: {
      getState: () => ({
        currentFilePath: filePath,
        workflowSessionMap: Object.fromEntries(
          Array.from(registeredSessionIds).map((sid) => [sid, `terminal-of-${filePath}`]),
        ),
        actions: {
          registerSession,
          handleHookEvent,
        },
      }),
    },
  };
  return entry;
}

const storeEntriesRef: { current: FakeStoreEntry[] } = { current: [] };

// terminal_id -> filePath, populated per-test to model
// useTerminalStore.fileStates.
const terminalOwnership: Record<string, string> = {};

vi.mock('../../store/storeManager', () => ({
  storeManager: {
    getAllStores: vi.fn(() => storeEntriesRef.current.map((e) => e.store)),
    getAllStoreEntries: vi.fn(() =>
      storeEntriesRef.current.map((e) => ({ filePath: e.filePath, store: e.store })),
    ),
    getStoreForFile: vi.fn((filePath: string) =>
      storeEntriesRef.current.find((e) => e.filePath === filePath)?.store,
    ),
    hasStore: vi.fn((filePath: string) =>
      storeEntriesRef.current.some((e) => e.filePath === filePath),
    ),
  },
}));

vi.mock('../../store/terminal/terminalStore', () => ({
  useTerminalStore: {
    getState: () => ({
      fileStates: Object.fromEntries(
        storeEntriesRef.current.map((e) => [
          e.filePath,
          {
            terminals: Object.entries(terminalOwnership)
              .filter(([, fp]) => fp === e.filePath)
              .map(([tid]) => ({ id: tid, title: tid, cwd: '/', shellCommand: '', shellArgs: [], pinnedToBottom: false })),
            activeTerminalId: null,
          },
        ]),
      ),
      markTerminalProcessing: () => {},
    }),
  },
}));

vi.mock('../../services/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { useHookEventListener } from '../useHookEventListener';

type HookEvent = {
  session_id: string;
  hook_event_name: string;
  terminal_id?: string;
  message?: string;
  source?: string;
};

describe('useHookEventListener — strict routing to owning store', () => {
  let hookEventCallback: (event: HookEvent) => void;
  let cleanup: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    storeEntriesRef.current = [];
    for (const k of Object.keys(terminalOwnership)) delete terminalOwnership[k];

    cleanup = vi.fn();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (global as any).window = {
      electron: {
        onHookEvent: vi.fn((cb: (event: HookEvent) => void) => {
          hookEventCallback = cb;
          return cleanup;
        }),
      },
    };
  });

  describe('SessionStart routes only to the store owning the terminal', () => {
    it('delivers registerSession to the file that owns terminal_id, not to other open files', () => {
      const owner = makeStore('/files/owner.arbo');
      const other = makeStore('/files/other.arbo');
      storeEntriesRef.current = [other, owner];
      terminalOwnership['terminal-1'] = '/files/owner.arbo';
      terminalOwnership['terminal-2'] = '/files/other.arbo';

      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-1',
          hook_event_name: 'SessionStart',
          terminal_id: 'terminal-1',
        });
      });

      expect(owner.registerSession).toHaveBeenCalledTimes(1);
      expect(owner.registerSession).toHaveBeenCalledWith('sess-1', 'terminal-1', undefined);
      expect(other.registerSession).not.toHaveBeenCalled();
    });

    it('does not call registerSession on any store when no file owns the terminal', () => {
      const a = makeStore('/files/a.arbo');
      const b = makeStore('/files/b.arbo');
      storeEntriesRef.current = [a, b];
      terminalOwnership['terminal-1'] = '/files/a.arbo';
      terminalOwnership['terminal-2'] = '/files/b.arbo';

      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-x',
          hook_event_name: 'SessionStart',
          terminal_id: 'terminal-orphan',
        });
      });

      expect(a.registerSession).not.toHaveBeenCalled();
      expect(b.registerSession).not.toHaveBeenCalled();
    });

    it('forwards the source argument unchanged when present (e.g. source="clear")', () => {
      const owner = makeStore('/files/owner.arbo');
      const other = makeStore('/files/other.arbo');
      storeEntriesRef.current = [owner, other];
      terminalOwnership['terminal-1'] = '/files/owner.arbo';

      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-clear',
          hook_event_name: 'SessionStart',
          terminal_id: 'terminal-1',
          source: 'clear',
        });
      });

      expect(owner.registerSession).toHaveBeenCalledTimes(1);
      expect(owner.registerSession).toHaveBeenCalledWith('sess-clear', 'terminal-1', 'clear');
      expect(other.registerSession).not.toHaveBeenCalled();
    });

    it('does not register a clear-session prompt twice when both stores are open (duplicate-commands symptom)', () => {
      const owner = makeStore('/files/owner.arbo');
      const bystander = makeStore('/files/bystander.arbo');
      storeEntriesRef.current = [owner, bystander];
      terminalOwnership['terminal-1'] = '/files/owner.arbo';

      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-1',
          hook_event_name: 'SessionStart',
          terminal_id: 'terminal-1',
          source: 'clear',
        });
      });

      // The bystander store must not see this clear-source SessionStart at
      // all — otherwise it would independently invoke its own
      // clearSessionManager.onClearConfirmed and re-send the gated
      // prompt to the terminal.
      expect(bystander.registerSession).not.toHaveBeenCalled();
    });

    // Post-fix behavior here is uncertain: the fix may either drop a
    // SessionStart that arrives without a terminal_id entirely, or fall
    // through to handleHookEvent (which is a no-op for SessionStart in
    // the current handler). Either is defensible — both prevent the
    // bug. Pinning it is left to the implementer.
    it('SessionStart with no terminal_id does not mutate any store (drop or no-op fall-through both acceptable)');
  });

  describe('Non-SessionStart events route only to the store with the session registered', () => {
    it('delivers Stop to the single store whose workflowSessionMap contains the session_id', () => {
      const owner = makeStore('/files/owner.arbo', { registeredSessionIds: ['sess-1'] });
      const other = makeStore('/files/other.arbo', { registeredSessionIds: ['sess-2'] });
      storeEntriesRef.current = [other, owner];

      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-1',
          hook_event_name: 'Stop',
        });
      });

      expect(owner.handleHookEvent).toHaveBeenCalledTimes(1);
      expect(owner.handleHookEvent).toHaveBeenCalledWith({
        session_id: 'sess-1',
        hook_event_name: 'Stop',
      });
      expect(other.handleHookEvent).not.toHaveBeenCalled();
    });

    it('delivers NeedsReview only to the owning store', () => {
      const owner = makeStore('/files/owner.arbo', { registeredSessionIds: ['sess-1'] });
      const other = makeStore('/files/other.arbo', { registeredSessionIds: ['sess-2'] });
      storeEntriesRef.current = [owner, other];

      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-1',
          hook_event_name: 'NeedsReview',
        });
      });

      expect(owner.handleHookEvent).toHaveBeenCalledTimes(1);
      expect(other.handleHookEvent).not.toHaveBeenCalled();
    });

    it('delivers Notification only to the owning store and forwards the message', () => {
      const owner = makeStore('/files/owner.arbo', { registeredSessionIds: ['sess-1'] });
      const other = makeStore('/files/other.arbo', { registeredSessionIds: ['sess-2'] });
      storeEntriesRef.current = [owner, other];

      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-1',
          hook_event_name: 'Notification',
          message: 'something needs attention',
        });
      });

      expect(owner.handleHookEvent).toHaveBeenCalledTimes(1);
      expect(owner.handleHookEvent).toHaveBeenCalledWith({
        session_id: 'sess-1',
        hook_event_name: 'Notification',
        message: 'something needs attention',
      });
      expect(other.handleHookEvent).not.toHaveBeenCalled();
    });

    it('delivers UserPromptSubmit only to the owning store', () => {
      const owner = makeStore('/files/owner.arbo', { registeredSessionIds: ['sess-1'] });
      const other = makeStore('/files/other.arbo', { registeredSessionIds: ['sess-2'] });
      storeEntriesRef.current = [owner, other];

      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-1',
          hook_event_name: 'UserPromptSubmit',
        });
      });

      expect(owner.handleHookEvent).toHaveBeenCalledTimes(1);
      expect(other.handleHookEvent).not.toHaveBeenCalled();
    });

    it('forwards unknown future event types to the owning store only (does not crash, does not broadcast)', () => {
      const owner = makeStore('/files/owner.arbo', { registeredSessionIds: ['sess-1'] });
      const other = makeStore('/files/other.arbo', { registeredSessionIds: ['sess-2'] });
      storeEntriesRef.current = [owner, other];

      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-1',
          hook_event_name: 'UnknownFutureEvent',
        });
      });

      expect(owner.handleHookEvent).toHaveBeenCalledTimes(1);
      expect(other.handleHookEvent).not.toHaveBeenCalled();
    });

    it('drops the event when no store has registered the session_id', () => {
      const a = makeStore('/files/a.arbo', { registeredSessionIds: ['sess-a'] });
      const b = makeStore('/files/b.arbo', { registeredSessionIds: ['sess-b'] });
      storeEntriesRef.current = [a, b];

      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-orphan',
          hook_event_name: 'Stop',
        });
      });

      expect(a.handleHookEvent).not.toHaveBeenCalled();
      expect(b.handleHookEvent).not.toHaveBeenCalled();
    });

    it('falls back to terminal_id when session_id is unknown — routes Stop to the store owning the terminal', () => {
      const owner = makeStore('/files/owner.arbo', { registeredSessionIds: ['sess-old'] });
      const other = makeStore('/files/other.arbo', { registeredSessionIds: [] });
      storeEntriesRef.current = [owner, other];
      terminalOwnership['terminal-1'] = '/files/owner.arbo';

      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-new-not-yet-registered',
          hook_event_name: 'Stop',
          terminal_id: 'terminal-1',
        });
      });

      expect(owner.handleHookEvent).toHaveBeenCalledTimes(1);
      expect(other.handleHookEvent).not.toHaveBeenCalled();
    });

    it('falls back to terminal_id for UserPromptSubmit so the pending-ack consumer is reached even when session_id is unknown', () => {
      const owner = makeStore('/files/owner.arbo', { registeredSessionIds: [] });
      storeEntriesRef.current = [owner];
      terminalOwnership['terminal-1'] = '/files/owner.arbo';

      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-new',
          hook_event_name: 'UserPromptSubmit',
          terminal_id: 'terminal-1',
        });
      });

      expect(owner.handleHookEvent).toHaveBeenCalledTimes(1);
      expect(owner.handleHookEvent).toHaveBeenCalledWith({
        session_id: 'sess-new',
        hook_event_name: 'UserPromptSubmit',
        terminal_id: 'terminal-1',
      });
    });

    it('does not fall back to terminal_id when no open file owns that terminal — drops the event', () => {
      const a = makeStore('/files/a.arbo', { registeredSessionIds: ['sess-a'] });
      storeEntriesRef.current = [a];
      // terminalOwnership left empty — no file owns 'terminal-orphan'

      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-unknown',
          hook_event_name: 'Stop',
          terminal_id: 'terminal-orphan',
        });
      });

      expect(a.handleHookEvent).not.toHaveBeenCalled();
    });
  });

  describe('two open files with concurrent workflows on separate terminals', () => {
    it('events for terminal-1 hit file-A only; events for terminal-2 hit file-B only', () => {
      const fileA = makeStore('/files/a.arbo', { registeredSessionIds: ['sess-a'] });
      const fileB = makeStore('/files/b.arbo', { registeredSessionIds: ['sess-b'] });
      storeEntriesRef.current = [fileA, fileB];
      terminalOwnership['terminal-1'] = '/files/a.arbo';
      terminalOwnership['terminal-2'] = '/files/b.arbo';

      renderHook(() => useHookEventListener());

      act(() => {
        // Stop arrives for sess-a (mapped in fileA)
        hookEventCallback({ session_id: 'sess-a', hook_event_name: 'Stop' });
        // Stop arrives for sess-b (mapped in fileB)
        hookEventCallback({ session_id: 'sess-b', hook_event_name: 'Stop' });
      });

      expect(fileA.handleHookEvent).toHaveBeenCalledTimes(1);
      expect(fileA.handleHookEvent).toHaveBeenCalledWith({
        session_id: 'sess-a',
        hook_event_name: 'Stop',
      });
      expect(fileB.handleHookEvent).toHaveBeenCalledTimes(1);
      expect(fileB.handleHookEvent).toHaveBeenCalledWith({
        session_id: 'sess-b',
        hook_event_name: 'Stop',
      });
    });

    it('a SessionStart on file-A\'s terminal does not corrupt file-B\'s session map (continue-says-assigned-to-another symptom)', () => {
      const fileA = makeStore('/files/a.arbo', { registeredSessionIds: ['sess-old-a'] });
      const fileB = makeStore('/files/b.arbo', { registeredSessionIds: ['sess-b'] });
      storeEntriesRef.current = [fileA, fileB];
      terminalOwnership['terminal-1'] = '/files/a.arbo';
      terminalOwnership['terminal-2'] = '/files/b.arbo';

      renderHook(() => useHookEventListener());

      act(() => {
        // A new session starts on file-A's terminal.
        hookEventCallback({
          session_id: 'sess-new-a',
          hook_event_name: 'SessionStart',
          terminal_id: 'terminal-1',
        });
      });

      // Only file-A learns about it. file-B keeps its own session map
      // intact; the new sess-new-a must not be added to fileB's map and
      // must not evict fileB's existing terminal-2 mapping.
      expect(fileA.registerSession).toHaveBeenCalledTimes(1);
      expect(fileB.registerSession).not.toHaveBeenCalled();
    });
  });

  describe('repeated and rapid events', () => {
    it('handles a SessionStart -> Stop -> SessionStart sequence on the same terminal without leaking to other stores', () => {
      const owner = makeStore('/files/owner.arbo', { registeredSessionIds: [] });
      const other = makeStore('/files/other.arbo', { registeredSessionIds: ['sess-other'] });
      storeEntriesRef.current = [owner, other];
      terminalOwnership['terminal-1'] = '/files/owner.arbo';

      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-old',
          hook_event_name: 'SessionStart',
          terminal_id: 'terminal-1',
        });
      });
      // After registerSession, owner now has sess-old in its map (the
      // makeStore fake mirrors the real registerSession side effect).
      act(() => {
        hookEventCallback({ session_id: 'sess-old', hook_event_name: 'Stop' });
      });
      act(() => {
        hookEventCallback({
          session_id: 'sess-new',
          hook_event_name: 'SessionStart',
          terminal_id: 'terminal-1',
        });
      });

      expect(owner.registerSession).toHaveBeenCalledTimes(2);
      expect(owner.handleHookEvent).toHaveBeenCalledTimes(1);
      expect(other.registerSession).not.toHaveBeenCalled();
      expect(other.handleHookEvent).not.toHaveBeenCalled();
    });
  });

  describe('boundary inputs', () => {
    it('does not crash when no stores are open', () => {
      storeEntriesRef.current = [];

      renderHook(() => useHookEventListener());

      expect(() =>
        act(() => {
          hookEventCallback({
            session_id: 'sess-1',
            hook_event_name: 'SessionStart',
            terminal_id: 'terminal-1',
          });
          hookEventCallback({ session_id: 'sess-1', hook_event_name: 'Stop' });
        }),
      ).not.toThrow();
    });

    it('does not crash when a store has an empty workflowSessionMap', () => {
      const empty = makeStore('/files/empty.arbo');
      storeEntriesRef.current = [empty];
      terminalOwnership['terminal-1'] = '/files/empty.arbo';

      renderHook(() => useHookEventListener());

      expect(() =>
        act(() => {
          hookEventCallback({ session_id: 'sess-unknown', hook_event_name: 'Stop' });
        }),
      ).not.toThrow();
      expect(empty.handleHookEvent).not.toHaveBeenCalled();
    });

    it('handles an undefined message field on Notification gracefully', () => {
      const owner = makeStore('/files/owner.arbo', { registeredSessionIds: ['sess-1'] });
      storeEntriesRef.current = [owner];

      renderHook(() => useHookEventListener());

      act(() => {
        hookEventCallback({
          session_id: 'sess-1',
          hook_event_name: 'Notification',
        });
      });

      expect(owner.handleHookEvent).toHaveBeenCalledTimes(1);
      expect(owner.handleHookEvent).toHaveBeenCalledWith({
        session_id: 'sess-1',
        hook_event_name: 'Notification',
      });
    });
  });

  describe('cross-store false positives the fix must eliminate', () => {
    it("does not raise 'terminal already assigned' on a bystander store when SessionStart fires for the owner's terminal");
    it('does not cause continueWorkflow on file-A to fail with "assigned to another" after a SessionStart on the same terminal');
  });

  describe('listener lifecycle', () => {
    it('still registers the electron listener on mount', () => {
      storeEntriesRef.current = [];
      renderHook(() => useHookEventListener());
      expect(window.electron.onHookEvent).toHaveBeenCalledWith(expect.any(Function));
    });

    it('still cleans up the electron listener on unmount', () => {
      storeEntriesRef.current = [];
      const { unmount } = renderHook(() => useHookEventListener());
      unmount();
      expect(cleanup).toHaveBeenCalled();
    });
  });
});
