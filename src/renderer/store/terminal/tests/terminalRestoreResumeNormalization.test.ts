import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { useTerminalStore } from '../terminalStore';

describe('materializeRestoredTerminals normalizes legacy "Resume" titles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateTerminal.mockImplementation((title: string, _a?: unknown, _b?: unknown, cwd?: string) =>
      Promise.resolve({
        id: `pty-${Math.random().toString(36).slice(2)}`,
        title,
        cwd: cwd ?? '/home',
        shellCommand: '/bin/bash',
        shellArgs: [],
        pinnedToBottom: true,
      }),
    );
    useTerminalStore.setState({
      terminals: [],
      activeTerminalId: null,
      currentFilePath: '/a.arbo',
      fileStates: {},
    });
  });

  it('rewrites a persisted "Resume" title to a "Terminal N" label on materialize', async () => {
    useTerminalStore.setState({
      currentFilePath: '/a.arbo',
      fileStates: {
        '/a.arbo': {
          terminals: [],
          activeTerminalId: null,
          pendingRestore: [{ title: 'Resume', cwd: '/recorded/cwd' }],
        },
      },
    });

    await useTerminalStore.getState().materializeRestoredTerminals();

    const created = useTerminalStore.getState().terminals;
    expect(created).toHaveLength(1);
    expect(created[0].title).not.toBe('Resume');
    expect(created[0].title).toMatch(/^Terminal \d+$/);
  });

  it('preserves a custom (non-"Resume") title across restore — does not renumber it', async () => {
    useTerminalStore.setState({
      currentFilePath: '/a.arbo',
      fileStates: {
        '/a.arbo': {
          terminals: [],
          activeTerminalId: null,
          pendingRestore: [{ title: 'Investigate session regression', cwd: '/cwd' }],
        },
      },
    });

    await useTerminalStore.getState().materializeRestoredTerminals();

    const [first] = useTerminalStore.getState().terminals;
    expect(first.title).toBe('Investigate session regression');
  });

  it('preserves the standard "Terminal 1" / "Terminal N" label across restore unchanged', async () => {
    useTerminalStore.setState({
      currentFilePath: '/a.arbo',
      fileStates: {
        '/a.arbo': {
          terminals: [],
          activeTerminalId: null,
          pendingRestore: [
            { title: 'Terminal 1', cwd: '/cwd' },
            { title: 'Terminal 2', cwd: '/cwd' },
          ],
        },
      },
    });

    await useTerminalStore.getState().materializeRestoredTerminals();

    const titles = useTerminalStore.getState().terminals.map((t) => t.title);
    expect(titles).toEqual(['Terminal 1', 'Terminal 2']);
  });

  it('numbers normalized "Resume" tabs based on the current restored list — no duplicate or skipped indices', async () => {
    useTerminalStore.setState({
      currentFilePath: '/a.arbo',
      fileStates: {
        '/a.arbo': {
          terminals: [],
          activeTerminalId: null,
          pendingRestore: [
            { title: 'Resume', cwd: '/cwd' },
            { title: 'Resume', cwd: '/cwd' },
            { title: 'Resume', cwd: '/cwd' },
          ],
        },
      },
    });

    await useTerminalStore.getState().materializeRestoredTerminals();

    const titles = useTerminalStore.getState().terminals.map((t) => t.title);
    expect(new Set(titles).size).toBe(titles.length);
    titles.forEach((t) => expect(t).toMatch(/^Terminal \d+$/));
  });

  it('mixed pendingRestore — only legacy "Resume" entries are normalized; custom titles untouched', async () => {
    useTerminalStore.setState({
      currentFilePath: '/a.arbo',
      fileStates: {
        '/a.arbo': {
          terminals: [],
          activeTerminalId: null,
          pendingRestore: [
            { title: 'Build', cwd: '/cwd' },
            { title: 'Resume', cwd: '/cwd' },
            { title: 'Investigate bug', cwd: '/cwd' },
          ],
        },
      },
    });

    await useTerminalStore.getState().materializeRestoredTerminals();

    const titles = useTerminalStore.getState().terminals.map((t) => t.title);
    expect(titles[0]).toBe('Build');
    expect(titles[1]).not.toBe('Resume');
    expect(titles[1]).toMatch(/^Terminal \d+$/);
    expect(titles[2]).toBe('Investigate bug');
  });

  it('skips Terminal N indices already taken by another pendingRestore entry — no duplicate labels', async () => {
    useTerminalStore.setState({
      currentFilePath: '/a.arbo',
      fileStates: {
        '/a.arbo': {
          terminals: [],
          activeTerminalId: null,
          pendingRestore: [
            { title: 'Terminal 2', cwd: '/cwd' },
            { title: 'Resume', cwd: '/cwd' },
          ],
        },
      },
    });

    await useTerminalStore.getState().materializeRestoredTerminals();

    const titles = useTerminalStore.getState().terminals.map((t) => t.title);
    expect(titles).toEqual(['Terminal 2', 'Terminal 1']);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('skips Terminal N indices already taken by an already-restored terminal', async () => {
    useTerminalStore.setState({
      currentFilePath: '/a.arbo',
      terminals: [
        { id: 'pre-1', title: 'Terminal 1', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true },
      ],
      activeTerminalId: 'pre-1',
      fileStates: {
        '/a.arbo': {
          terminals: [
            { id: 'pre-1', title: 'Terminal 1', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true },
          ],
          activeTerminalId: 'pre-1',
          pendingRestore: [{ title: 'Resume', cwd: '/cwd' }],
        },
      },
    });

    await useTerminalStore.getState().materializeRestoredTerminals();

    const titles = useTerminalStore.getState().terminals.map((t) => t.title);
    expect(titles).toContain('Terminal 1');
    const normalized = titles.filter((t) => t !== 'Terminal 1');
    expect(normalized).toEqual(['Terminal 2']);
  });
});
