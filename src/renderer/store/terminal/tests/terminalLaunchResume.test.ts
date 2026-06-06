import { describe, it, expect, beforeEach, vi } from 'vitest';

// PR3 — Resume every open file's Claude sessions at launch (terminal-store layer).
// Covers persisting the per-terminal sessionId and materializing every open
// file's restored terminals at launch (decoupled from the active file), each
// carrying a resume target for the launch fan-out. The quiet resume-into-existing
// primitive, the throttled orchestration, and the app-init wiring are tested in
// their own files (workflowSessionResumeRestored, concurrency, launchSessionResume).

const { mockSaveTerminalSession, mockGetTerminalSession, mockCreateTerminal } = vi.hoisted(() => ({
  mockSaveTerminalSession: vi.fn(),
  mockGetTerminalSession: vi.fn().mockResolvedValue(null),
  mockCreateTerminal: vi.fn(),
}));

vi.mock('../../../services/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock('../../../services/storageService', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    saveTerminalSession: mockSaveTerminalSession,
    getTerminalSession: mockGetTerminalSession,
  })),
}));

vi.mock('../../../services/terminalService', () => ({
  createTerminal: mockCreateTerminal,
}));

import { useTerminalStore, setTerminalSessionResolver } from '../terminalStore';

type EntryWithSession = { title: string; cwd: string; originNodeId?: string; sessionId?: string };

function plainTerminal(id: string, title: string, cwd = '/home') {
  return { id, title, cwd, shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true };
}

let spawnCounter = 0;

beforeEach(() => {
  vi.clearAllMocks();
  spawnCounter = 0;
  mockCreateTerminal.mockImplementation((title: string, _sc, _sa, cwd?: string) =>
    Promise.resolve({
      id: `pty-${++spawnCounter}`,
      title,
      cwd: cwd ?? '/home',
      shellCommand: '/bin/bash',
      shellArgs: [],
      pinnedToBottom: true,
    }),
  );
  // The resolver is shared module state injected by storeManager — reset it.
  setTerminalSessionResolver(() => undefined);
  useTerminalStore.setState({
    terminals: [],
    activeTerminalId: null,
    currentFilePath: null,
    fileStates: {},
  });
});

describe('persist sessionId — buildTerminalSession reads the injected resolver', () => {
  it('persists each terminal sessionId resolved from the file workflowSessionMap', async () => {
    setTerminalSessionResolver((filePath, terminalId) =>
      filePath === '/a.arbo' && terminalId === 'term-1' ? 'sess-1' : undefined,
    );
    useTerminalStore.getState().setActiveFile('/a.arbo');
    useTerminalStore.getState().addTerminal(plainTerminal('term-1', 'First'));
    useTerminalStore.getState().addTerminal(plainTerminal('term-2', 'Second'));

    await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());
    const saved = mockSaveTerminalSession.mock.calls.at(-1)![0];
    const terminals = saved.fileStates['/a.arbo'].terminals as EntryWithSession[];

    expect(terminals[0].sessionId).toBe('sess-1');
    expect(terminals[1].sessionId).toBeUndefined();
  });

  it('round-trips sessionId through save then restore into pendingRestore', async () => {
    setTerminalSessionResolver(() => 'sess-9');
    useTerminalStore.getState().setActiveFile('/a.arbo');
    useTerminalStore.getState().addTerminal(plainTerminal('t1', 'Terminal'));

    await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());
    const saved = mockSaveTerminalSession.mock.calls.at(-1)![0];

    useTerminalStore.setState({ terminals: [], activeTerminalId: null, currentFilePath: null, fileStates: {} });
    mockGetTerminalSession.mockResolvedValue(saved);
    await useTerminalStore.getState().restoreTerminalSession();

    const pending = useTerminalStore.getState().fileStates['/a.arbo'].pendingRestore as EntryWithSession[];
    expect(pending[0].sessionId).toBe('sess-9');
  });
});

describe('materializeAllRestoredTerminals — every open file at launch', () => {
  beforeEach(() => {
    mockGetTerminalSession.mockResolvedValue({
      fileStates: {
        '/a.arbo': {
          terminals: [{ title: 'Terminal', cwd: '/a', sessionId: 'sess-a', originNodeId: 'node-a' }],
          activeTerminalIndex: 0,
        },
        '/b.arbo': {
          terminals: [
            { title: 'Build', cwd: '/b', sessionId: 'sess-b' },
            { title: 'Plain', cwd: '/b' },
          ],
          activeTerminalIndex: 0,
        },
      },
    });
  });

  it('materializes every open file\'s restored terminals, not just the active file', async () => {
    await useTerminalStore.getState().restoreTerminalSession();
    await useTerminalStore.getState().materializeAllRestoredTerminals();

    const fileStates = useTerminalStore.getState().fileStates;
    expect(fileStates['/a.arbo'].terminals).toHaveLength(1);
    expect(fileStates['/b.arbo'].terminals).toHaveLength(2);
    expect(mockCreateTerminal).toHaveBeenCalledTimes(3);
  });

  it('returns one resume target per restored entry that carries a sessionId, scoped to its file', async () => {
    await useTerminalStore.getState().restoreTerminalSession();
    const targets = await useTerminalStore.getState().materializeAllRestoredTerminals();

    expect(targets).toHaveLength(2);
    expect(targets.map((t) => t.sessionId).sort()).toEqual(['sess-a', 'sess-b']);
    expect(targets.find((t) => t.sessionId === 'sess-a')?.filePath).toBe('/a.arbo');
    expect(targets.find((t) => t.sessionId === 'sess-b')?.filePath).toBe('/b.arbo');
    expect(targets.every((t) => typeof t.terminalId === 'string' && t.terminalId.length > 0)).toBe(true);
  });

  it('materializes a no-sessionId entry as a plain shell with no resume target (backward-compat)', async () => {
    await useTerminalStore.getState().restoreTerminalSession();
    const targets = await useTerminalStore.getState().materializeAllRestoredTerminals();

    expect(useTerminalStore.getState().fileStates['/b.arbo'].terminals).toHaveLength(2);
    expect(targets.some((t) => t.filePath === '/b.arbo' && t.sessionId === 'sess-b')).toBe(true);
    expect(targets.filter((t) => t.filePath === '/b.arbo')).toHaveLength(1);
  });

  it('falls back to a quiet plain shell with no resume target when a restored folder no longer exists', async () => {
    mockGetTerminalSession.mockResolvedValue({
      fileStates: {
        '/c.arbo': {
          terminals: [{ title: 'Gone', cwd: '/deleted/folder', sessionId: 'sess-gone', originNodeId: 'node-c' }],
          activeTerminalIndex: 0,
        },
      },
    });
    // The persisted folder is gone: spawning in it rejects, but the default cwd succeeds.
    mockCreateTerminal.mockImplementation((title: string, _sc, _sa, cwd?: string) =>
      cwd === '/deleted/folder'
        ? Promise.reject(new Error('ENOENT: no such directory'))
        : Promise.resolve({ id: `pty-${++spawnCounter}`, title, cwd: cwd ?? '/home', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true }),
    );

    await useTerminalStore.getState().restoreTerminalSession();
    const targets = await useTerminalStore.getState().materializeAllRestoredTerminals();

    // The tab still restores (a plain shell in the default cwd), but it is not resumed.
    expect(useTerminalStore.getState().fileStates['/c.arbo'].terminals).toHaveLength(1);
    expect(targets).toHaveLength(0);
  });

  it('clears pendingRestore on launch materialization so switching files does not re-spawn', async () => {
    await useTerminalStore.getState().restoreTerminalSession();
    await useTerminalStore.getState().materializeAllRestoredTerminals();

    const fileStates = useTerminalStore.getState().fileStates;
    expect(fileStates['/a.arbo'].pendingRestore).toBeUndefined();
    expect(fileStates['/b.arbo'].pendingRestore).toBeUndefined();

    mockCreateTerminal.mockClear();
    useTerminalStore.getState().setActiveFile('/a.arbo');
    await useTerminalStore.getState().materializeRestoredTerminals();
    expect(mockCreateTerminal).not.toHaveBeenCalled();
  });
});

describe('durable sessionId — survives the workflowSessionMap wipe on load', () => {
  beforeEach(() => {
    mockGetTerminalSession.mockResolvedValue({
      fileStates: {
        '/a.arbo': {
          terminals: [{ title: 'Resumable', cwd: '/a', sessionId: 'sess-a', originNodeId: 'node-a' }],
          activeTerminalIndex: 0,
        },
      },
    });
  });

  it('persists the restored sessionId on the post-materialize save even when the live resolver is empty', async () => {
    // initializeExecutionState wipes the live workflowSessionMap on load, so the
    // resolver sees nothing until a session re-binds. Without the durable fallback
    // this save would erase the sessionId from the persisted record.
    setTerminalSessionResolver(() => undefined);

    await useTerminalStore.getState().restoreTerminalSession();
    await useTerminalStore.getState().materializeAllRestoredTerminals();

    await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());
    const saved = mockSaveTerminalSession.mock.calls.at(-1)![0];
    const terminals = saved.fileStates['/a.arbo'].terminals as EntryWithSession[];
    expect(terminals[0].sessionId).toBe('sess-a');
  });

  it('lets a live binding take precedence over the restored fallback', async () => {
    setTerminalSessionResolver(() => 'sess-live');

    await useTerminalStore.getState().restoreTerminalSession();
    await useTerminalStore.getState().materializeAllRestoredTerminals();

    await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());
    const saved = mockSaveTerminalSession.mock.calls.at(-1)![0];
    const terminals = saved.fileStates['/a.arbo'].terminals as EntryWithSession[];
    expect(terminals[0].sessionId).toBe('sess-live');
  });
});

describe('restore — sessionId carry-through and per-file cap', () => {
  it('carries each restored entry sessionId verbatim into pendingRestore', async () => {
    mockGetTerminalSession.mockResolvedValue({
      fileStates: {
        '/a.arbo': {
          terminals: [
            { title: 'Terminal', cwd: '/home/user', sessionId: 'sess-1', originNodeId: 'node-1' },
            { title: 'Build', cwd: '/project' },
          ],
          activeTerminalIndex: 0,
        },
      },
    });

    await useTerminalStore.getState().restoreTerminalSession();

    const pending = useTerminalStore.getState().fileStates['/a.arbo'].pendingRestore as EntryWithSession[] | undefined;
    expect(pending?.[0].sessionId).toBe('sess-1');
    expect(pending?.[1].sessionId).toBeUndefined();
  });

  it('caps restored terminals per file so a runaway count cannot spawn unbounded shells', async () => {
    mockGetTerminalSession.mockResolvedValue({
      fileStates: {
        '/a.arbo': {
          terminals: Array.from({ length: 7 }, (_, i) => ({ title: `T${i}`, cwd: '/a' })),
          activeTerminalIndex: 0,
        },
      },
    });

    await useTerminalStore.getState().restoreTerminalSession();
    expect(useTerminalStore.getState().fileStates['/a.arbo'].pendingRestore).toHaveLength(5);
  });
});
