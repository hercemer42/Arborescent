import { describe, it, expect, beforeEach, vi } from 'vitest';

// PR1 — Restore terminals under their correct .arbo file on restart.
//
// The persisted session is already keyed per file; the defect is in materialization.
// materializeRestoredTerminals routes each restored entry through the global
// addTerminal, which reads currentFilePath fresh on every call and saves on every
// iteration. If the active file switches while a PTY is still spawning (init flow or
// a user file-switch), later terminals land in whichever file is now active and the
// mis-grouped layout is re-persisted, sticking across the next restart.
//
// These tests pin the per-file association at the store layer. Accessibility is not
// applicable here — there is no DOM at this layer; the UX guarantee ("the user can
// trust which terminals belong to which file") is encoded as the association and
// isolation assertions below.

const { mockSaveTerminalSession, mockGetTerminalSession, mockCreateTerminal } = vi.hoisted(() => ({
  mockSaveTerminalSession: vi.fn(),
  mockGetTerminalSession: vi.fn().mockResolvedValue(null),
  mockCreateTerminal: vi.fn(),
}));

vi.mock('../../../services/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../../services/terminalService', () => ({
  createTerminal: mockCreateTerminal,
}));

vi.mock('../../../services/storageService', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    saveTerminalSession: mockSaveTerminalSession,
    getTerminalSession: mockGetTerminalSession,
  })),
}));

import { useTerminalStore, TerminalInfo } from '../terminalStore';

function pty(title: string, cwd: string) {
  return {
    id: `pty-${title}-${Math.random().toString(36).slice(2)}`,
    title,
    cwd,
    shellCommand: '/bin/bash',
    shellArgs: [],
    pinnedToBottom: true,
  };
}

function liveTerminal(id: string, title: string, cwd = '/home'): TerminalInfo {
  return { id, title, cwd, shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true };
}

function titlesIn(filePath: string): string[] {
  return (useTerminalStore.getState().fileStates[filePath]?.terminals ?? []).map((t) => t.title);
}

// Builds a createTerminal stub that switches the active file to `to` while the
// `switchOnSpawn`-th PTY is still in flight, reproducing an interleaved file switch.
function spawnWithFileSwitch(to: string, switchOnSpawn = 1) {
  let spawns = 0;
  return (title: string, _a?: unknown, _b?: unknown, cwd?: string) => {
    spawns += 1;
    if (spawns === switchOnSpawn) useTerminalStore.getState().setActiveFile(to);
    return Promise.resolve(pty(title, cwd ?? '/home'));
  };
}

describe('materializeRestoredTerminals — per-file association on restart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetTerminalSession.mockResolvedValue(null);
    mockCreateTerminal.mockImplementation((title: string, _a?: unknown, _b?: unknown, cwd?: string) =>
      Promise.resolve(pty(title, cwd ?? '/home')),
    );
    useTerminalStore.setState({
      terminals: [],
      activeTerminalId: null,
      currentFilePath: null,
      fileStates: {},
      terminalProcessing: {},
    });
    window.electron = {
      ...window.electron,
      terminalGetCwd: vi.fn().mockResolvedValue(undefined),
      terminalDestroy: vi.fn().mockResolvedValue(undefined),
    } as unknown as typeof window.electron;
  });

  describe('single-file restore (regression — unchanged behavior)', () => {
    it('materializes all pending terminals under the single active file with titles and cwds preserved', async () => {
      useTerminalStore.setState({
        currentFilePath: '/solo.arbo',
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/solo.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [
              { title: 'Terminal 1', cwd: '/work/one' },
              { title: 'Build', cwd: '/work/two' },
            ],
          },
        },
      });

      await useTerminalStore.getState().materializeRestoredTerminals();

      const restored = useTerminalStore.getState().fileStates['/solo.arbo'].terminals;
      expect(restored.map((t) => t.title)).toEqual(['Terminal 1', 'Build']);
      expect(restored.map((t) => t.cwd)).toEqual(['/work/one', '/work/two']);
      expect(useTerminalStore.getState().fileStates['/solo.arbo'].pendingRestore).toBeUndefined();
      expect(Object.keys(useTerminalStore.getState().fileStates)).toEqual(['/solo.arbo']);
    });
  });

  describe('multi-file restore — matching per-file counts and metadata', () => {
    it('restores each file\'s terminals under that file with matching counts, titles, and cwds', async () => {
      useTerminalStore.setState({
        currentFilePath: null,
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/a.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [
              { title: 'A1', cwd: '/a/one' },
              { title: 'A2', cwd: '/a/two' },
            ],
          },
          '/b.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [{ title: 'B1', cwd: '/b/one' }],
          },
        },
      });

      useTerminalStore.getState().setActiveFile('/a.arbo');
      await useTerminalStore.getState().materializeRestoredTerminals();
      useTerminalStore.getState().setActiveFile('/b.arbo');
      await useTerminalStore.getState().materializeRestoredTerminals();

      expect(titlesIn('/a.arbo')).toEqual(['A1', 'A2']);
      expect(titlesIn('/b.arbo')).toEqual(['B1']);
      expect(useTerminalStore.getState().fileStates['/a.arbo'].terminals.map((t) => t.cwd)).toEqual(['/a/one', '/a/two']);
      expect(useTerminalStore.getState().fileStates['/b.arbo'].terminals.map((t) => t.cwd)).toEqual(['/b/one']);
    });

    it('opening file A shows only A\'s terminals and opening file B shows only B\'s', async () => {
      useTerminalStore.setState({
        currentFilePath: null,
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/a.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [{ title: 'A1', cwd: '/a' }],
          },
          '/b.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [{ title: 'B1', cwd: '/b' }],
          },
        },
      });

      useTerminalStore.getState().setActiveFile('/a.arbo');
      await useTerminalStore.getState().materializeRestoredTerminals();
      useTerminalStore.getState().setActiveFile('/b.arbo');
      await useTerminalStore.getState().materializeRestoredTerminals();

      useTerminalStore.getState().setActiveFile('/a.arbo');
      const visibleA = useTerminalStore.getState().terminals.map((t) => t.title);
      expect(visibleA).toEqual(['A1']);
      expect(visibleA).not.toContain('B1');

      useTerminalStore.getState().setActiveFile('/b.arbo');
      const visibleB = useTerminalStore.getState().terminals.map((t) => t.title);
      expect(visibleB).toEqual(['B1']);
      expect(visibleB).not.toContain('A1');
    });
  });

  describe('does not misroute terminals when the active file switches mid-restore', () => {
    it('keeps a file\'s restored terminals in its own bucket even if a file switch interleaves with an in-flight PTY spawn', async () => {
      useTerminalStore.setState({
        currentFilePath: '/a.arbo',
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/a.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [
              { title: 'A1', cwd: '/a/one' },
              { title: 'A2', cwd: '/a/two' },
            ],
          },
        },
      });

      mockCreateTerminal.mockImplementation(spawnWithFileSwitch('/b.arbo'));

      await useTerminalStore.getState().materializeRestoredTerminals();

      expect(titlesIn('/a.arbo')).toEqual(['A1', 'A2']);
      expect(titlesIn('/b.arbo')).not.toContain('A1');
      expect(titlesIn('/b.arbo')).not.toContain('A2');
    });

    it('never persists a layout that files one file\'s terminals under another', async () => {
      useTerminalStore.setState({
        currentFilePath: '/a.arbo',
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/a.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [
              { title: 'A1', cwd: '/a/one' },
              { title: 'A2', cwd: '/a/two' },
            ],
          },
          '/b.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [{ title: 'B1', cwd: '/b/one' }],
          },
        },
      });

      mockCreateTerminal.mockImplementation(spawnWithFileSwitch('/b.arbo'));

      await useTerminalStore.getState().materializeRestoredTerminals();
      await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());
      await new Promise((resolve) => setTimeout(resolve, 0));

      for (const [session] of mockSaveTerminalSession.mock.calls) {
        const aTitles = (session.fileStates['/a.arbo']?.terminals ?? []).map((t: { title: string }) => t.title);
        const bTitles = (session.fileStates['/b.arbo']?.terminals ?? []).map((t: { title: string }) => t.title);
        expect(bTitles).not.toContain('A1');
        expect(bTitles).not.toContain('A2');
        expect(aTitles).not.toContain('B1');
      }
    });
  });

  describe('isolation from other files', () => {
    it('restoring one file does not move, duplicate, or drop another file\'s existing terminals', async () => {
      useTerminalStore.setState({
        currentFilePath: '/a.arbo',
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/a.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [
              { title: 'A1', cwd: '/a/one' },
              { title: 'A2', cwd: '/a/two' },
            ],
          },
          '/b.arbo': {
            terminals: [liveTerminal('b-live', 'B-live', '/b')],
            activeTerminalId: 'b-live',
          },
        },
      });

      mockCreateTerminal.mockImplementation(spawnWithFileSwitch('/b.arbo'));

      await useTerminalStore.getState().materializeRestoredTerminals();

      const bTerminals = useTerminalStore.getState().fileStates['/b.arbo'].terminals;
      expect(bTerminals).toHaveLength(1);
      expect(bTerminals[0].id).toBe('b-live');
    });
  });

  describe('repeated and concurrent restore interactions', () => {
    it('a second materialize for the same file is a no-op and does not duplicate terminals', async () => {
      useTerminalStore.setState({
        currentFilePath: '/a.arbo',
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/a.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [{ title: 'A1', cwd: '/a' }],
          },
        },
      });

      await useTerminalStore.getState().materializeRestoredTerminals();
      await useTerminalStore.getState().materializeRestoredTerminals();

      expect(titlesIn('/a.arbo')).toEqual(['A1']);
    });

    it.todo('two restore passes overlapping in time each land their own file\'s terminals in the correct bucket');
  });

  describe('failure handling', () => {
    it('continues restoring a file\'s remaining terminals under the correct file when one PTY spawn fails', async () => {
      useTerminalStore.setState({
        currentFilePath: '/a.arbo',
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/a.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [
              { title: 'A1', cwd: '/a/one' },
              { title: 'A2', cwd: '/a/two' },
              { title: 'A3', cwd: '/a/three' },
            ],
          },
        },
      });

      mockCreateTerminal.mockImplementation((title: string, _a?: unknown, _b?: unknown, cwd?: string) => {
        if (title === 'A2') return Promise.reject(new Error('pty spawn failed'));
        return Promise.resolve(pty(title, cwd ?? '/home'));
      });

      await useTerminalStore.getState().materializeRestoredTerminals();

      expect(titlesIn('/a.arbo')).toEqual(['A1', 'A3']);
    });

    it.todo('pre-existing: when every PTY spawn for a file fails its pendingRestore is cleared in memory and a later save from any source drops the file from the persisted session — fixing it means coupling the pendingRestore clear to spawn success without reopening the same-file re-entrancy guard');
  });

  describe('empty, null, and isolation edge cases', () => {
    it('a no-op restore for an empty target file leaves other files\' pending restores intact', async () => {
      useTerminalStore.setState({
        currentFilePath: '/empty.arbo',
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/empty.arbo': { terminals: [], activeTerminalId: null },
          '/b.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [{ title: 'B1', cwd: '/b' }],
          },
        },
      });

      await useTerminalStore.getState().materializeRestoredTerminals();

      expect(useTerminalStore.getState().fileStates['/b.arbo'].pendingRestore).toEqual([{ title: 'B1', cwd: '/b' }]);
      expect(mockCreateTerminal).not.toHaveBeenCalled();
    });

    it('is a no-op with no active file and does not spawn or touch any bucket', async () => {
      useTerminalStore.setState({
        currentFilePath: null,
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/b.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [{ title: 'B1', cwd: '/b' }],
          },
        },
      });

      await expect(useTerminalStore.getState().materializeRestoredTerminals()).resolves.not.toThrow();
      expect(mockCreateTerminal).not.toHaveBeenCalled();
      expect(useTerminalStore.getState().fileStates['/b.arbo'].pendingRestore).toEqual([{ title: 'B1', cwd: '/b' }]);
    });
  });

  describe('per-file restore cap (boundary)', () => {
    it('caps each file independently at the per-file maximum without bleeding across files', async () => {
      mockGetTerminalSession.mockResolvedValue({
        fileStates: {
          '/a.arbo': {
            terminals: Array.from({ length: 7 }, (_, i) => ({ title: `A${i}`, cwd: '/a' })),
            activeTerminalIndex: 0,
          },
          '/b.arbo': {
            terminals: Array.from({ length: 3 }, (_, i) => ({ title: `B${i}`, cwd: '/b' })),
            activeTerminalIndex: 0,
          },
        },
      });

      await useTerminalStore.getState().restoreTerminalSession();

      expect(useTerminalStore.getState().fileStates['/a.arbo'].pendingRestore).toHaveLength(5);
      expect(useTerminalStore.getState().fileStates['/b.arbo'].pendingRestore).toHaveLength(3);
    });
  });
});
