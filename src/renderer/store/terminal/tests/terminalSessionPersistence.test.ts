import { describe, it, expect, beforeEach, vi } from 'vitest';

const { mockSaveTerminalSession, mockGetTerminalSession } = vi.hoisted(() => ({
  mockSaveTerminalSession: vi.fn(),
  mockGetTerminalSession: vi.fn().mockResolvedValue(null),
}));

vi.mock('../../../services/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../../services/terminalService', () => ({
  createTerminal: vi.fn().mockImplementation((title: string) => Promise.resolve({
    id: `terminal-${Date.now()}`,
    title,
    cwd: '/home/user',
    shellCommand: '/bin/bash',
    shellArgs: [],
    pinnedToBottom: true,
  })),
}));

vi.mock('../../../services/storageService', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    saveTerminalSession: mockSaveTerminalSession,
    getTerminalSession: mockGetTerminalSession,
  })),
}));

import { useTerminalStore } from '../terminalStore';

const mockTerminalCreate = vi.fn().mockImplementation((_id: string, title: string) =>
  Promise.resolve({
    id: `pty-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title,
    cwd: '/home/user',
    shellCommand: '/bin/bash',
    shellArgs: [],
  })
);
const mockTerminalDestroy = vi.fn().mockResolvedValue(undefined);

describe('terminal session per-file persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTerminalStore.setState({
      terminals: [],
      activeTerminalId: null,
      currentFilePath: null,
      fileStates: {},
    });
    window.electron = {
      ...window.electron,
      terminalCreate: mockTerminalCreate,
      terminalDestroy: mockTerminalDestroy,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  describe('saveTerminalSession saves per-file metadata', () => {
    it('should save fileStates with title and cwd for each terminal per file', async () => {
      useTerminalStore.getState().setActiveFile('/project-a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-1', title: 'Terminal', cwd: '/home/user',
        shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });
      useTerminalStore.getState().addTerminal({
        id: 'term-2', title: 'Build', cwd: '/home/user/project',
        shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: false,
      });

      useTerminalStore.getState().setActiveFile('/project-b.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-3', title: 'Terminal', cwd: '/tmp',
        shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());
      const lastCall = mockSaveTerminalSession.mock.calls[mockSaveTerminalSession.mock.calls.length - 1][0];
      expect(lastCall.fileStates['/project-a.arbo'].terminals).toHaveLength(2);
      expect(lastCall.fileStates['/project-a.arbo'].terminals[0]).toEqual(
        expect.objectContaining({ title: 'Terminal', cwd: '/home/user' })
      );
      expect(lastCall.fileStates['/project-a.arbo'].terminals[1]).toEqual(
        expect.objectContaining({ title: 'Build', cwd: '/home/user/project' })
      );
      expect(lastCall.fileStates['/project-b.arbo'].terminals).toHaveLength(1);
    });

    it('should save activeTerminalIndex based on which terminal is active', async () => {
      useTerminalStore.getState().setActiveFile('/a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-1', title: 'First', cwd: '/',
        shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });
      useTerminalStore.getState().addTerminal({
        id: 'term-2', title: 'Second', cwd: '/',
        shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());
      const lastCall = mockSaveTerminalSession.mock.calls[mockSaveTerminalSession.mock.calls.length - 1][0];
      expect(lastCall.fileStates['/a.arbo'].activeTerminalIndex).toBe(1);
    });

    it('should not include ephemeral fields like id, shellCommand, shellArgs, pinnedToBottom', async () => {
      useTerminalStore.getState().setActiveFile('/a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-1', title: 'Terminal', cwd: '/home',
        shellCommand: '/bin/zsh', shellArgs: ['-i'], pinnedToBottom: true,
      });

      await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());
      const lastCall = mockSaveTerminalSession.mock.calls[mockSaveTerminalSession.mock.calls.length - 1][0];
      const savedTerminal = lastCall.fileStates['/a.arbo'].terminals[0];
      expect(savedTerminal).not.toHaveProperty('id');
      expect(savedTerminal).not.toHaveProperty('shellCommand');
      expect(savedTerminal).not.toHaveProperty('shellArgs');
      expect(savedTerminal).not.toHaveProperty('pinnedToBottom');
    });
  });

  describe('restoreTerminalSession populates fileStates without spawning PTYs', () => {
    it('should populate fileStates from saved session data', async () => {
      mockGetTerminalSession.mockResolvedValue({
        fileStates: {
          '/a.arbo': {
            terminals: [
              { title: 'Terminal', cwd: '/home/user' },
              { title: 'Build', cwd: '/project' },
            ],
            activeTerminalIndex: 0,
          },
          '/b.arbo': {
            terminals: [{ title: 'Terminal', cwd: '/tmp' }],
            activeTerminalIndex: 0,
          },
        },
      });

      await useTerminalStore.getState().restoreTerminalSession();

      const { fileStates } = useTerminalStore.getState();
      expect(Object.keys(fileStates)).toHaveLength(2);
      expect(fileStates['/a.arbo']).toBeDefined();
      expect(fileStates['/b.arbo']).toBeDefined();
    });

    it('should not call terminalCreate during restore', async () => {
      mockGetTerminalSession.mockResolvedValue({
        fileStates: {
          '/a.arbo': {
            terminals: [{ title: 'Terminal', cwd: '/home' }],
            activeTerminalIndex: 0,
          },
        },
      });

      await useTerminalStore.getState().restoreTerminalSession();

      expect(mockTerminalCreate).not.toHaveBeenCalled();
    });

    it('should not set global terminals until setActiveFile is called', async () => {
      mockGetTerminalSession.mockResolvedValue({
        fileStates: {
          '/a.arbo': {
            terminals: [{ title: 'Terminal', cwd: '/home' }],
            activeTerminalIndex: 0,
          },
        },
      });

      await useTerminalStore.getState().restoreTerminalSession();

      expect(useTerminalStore.getState().terminals).toHaveLength(0);
    });
  });

  describe('restoreTerminalSession handles null session', () => {
    it('should leave fileStates empty when no session exists', async () => {
      mockGetTerminalSession.mockResolvedValue(null);

      await useTerminalStore.getState().restoreTerminalSession();

      expect(useTerminalStore.getState().fileStates).toEqual({});
    });

    it('should not throw when session is null', async () => {
      mockGetTerminalSession.mockResolvedValue(null);

      await expect(useTerminalStore.getState().restoreTerminalSession()).resolves.not.toThrow();
    });
  });

  describe('lazy PTY creation via materializeRestoredTerminals', () => {
    it('should create PTY processes for pending restored terminals', async () => {
      useTerminalStore.setState({
        currentFilePath: '/a.arbo',
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/a.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [
              { title: 'Terminal', cwd: '/home/user' },
              { title: 'Build', cwd: '/project' },
            ],
          },
        },
      });

      await useTerminalStore.getState().materializeRestoredTerminals();

      expect(useTerminalStore.getState().terminals).toHaveLength(2);
    });

    it('should be a no-op when no pending restore exists', async () => {
      useTerminalStore.setState({
        currentFilePath: '/a.arbo',
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/a.arbo': { terminals: [], activeTerminalId: null },
        },
      });

      await useTerminalStore.getState().materializeRestoredTerminals();

      expect(useTerminalStore.getState().terminals).toHaveLength(0);
    });

    it('should use saved cwd when creating terminals from restored metadata', async () => {
      const { createTerminal } = await import('../../../services/terminalService');

      useTerminalStore.setState({
        currentFilePath: '/a.arbo',
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/a.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [{ title: 'Terminal', cwd: '/custom/dir' }],
          },
        },
      });

      await useTerminalStore.getState().materializeRestoredTerminals();

      expect(createTerminal).toHaveBeenCalledWith('Terminal', undefined, undefined, '/custom/dir');
    });

    it('should clear pendingRestore after materialization', async () => {
      useTerminalStore.setState({
        currentFilePath: '/a.arbo',
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/a.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [{ title: 'Terminal', cwd: '/home' }],
          },
        },
      });

      await useTerminalStore.getState().materializeRestoredTerminals();

      expect(useTerminalStore.getState().fileStates['/a.arbo'].pendingRestore).toBeUndefined();
    });

    it('should be a no-op when no active file', async () => {
      useTerminalStore.setState({
        currentFilePath: null,
        terminals: [],
        activeTerminalId: null,
        fileStates: {},
      });

      await useTerminalStore.getState().materializeRestoredTerminals();
      // No error thrown
    });
  });

  describe('terminal mutations trigger saveTerminalSession', () => {
    it('should save session when a terminal is added', async () => {
      useTerminalStore.getState().setActiveFile('/a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-1', title: 'Terminal', cwd: '/',
        shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());
    });

    it('should save session when a terminal is closed', async () => {
      useTerminalStore.getState().setActiveFile('/a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-1', title: 'Terminal', cwd: '/',
        shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });
      mockSaveTerminalSession.mockClear();

      await useTerminalStore.getState().closeTerminal('term-1');

      expect(mockSaveTerminalSession).toHaveBeenCalled();
    });

    it('should save session when closeFileTerminals is called', async () => {
      useTerminalStore.getState().setActiveFile('/a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-1', title: 'Terminal', cwd: '/',
        shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });
      mockSaveTerminalSession.mockClear();

      await useTerminalStore.getState().closeFileTerminals('/a.arbo');

      expect(mockSaveTerminalSession).toHaveBeenCalled();
    });

    it('should save session when a terminal is removed', async () => {
      useTerminalStore.getState().setActiveFile('/a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-1', title: 'Terminal', cwd: '/',
        shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });
      await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());
      mockSaveTerminalSession.mockClear();

      useTerminalStore.getState().removeTerminal('term-1');

      await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());
    });
  });

  describe('edge cases', () => {
    it('should handle saved session with empty fileStates map', async () => {
      mockGetTerminalSession.mockResolvedValue({
        fileStates: {},
      });

      await useTerminalStore.getState().restoreTerminalSession();

      expect(useTerminalStore.getState().fileStates).toEqual({});
    });

    it('should handle saved session with a file that has zero terminals', async () => {
      mockGetTerminalSession.mockResolvedValue({
        fileStates: {
          '/a.arbo': {
            terminals: [],
            activeTerminalIndex: null,
          },
        },
      });

      await useTerminalStore.getState().restoreTerminalSession();

      expect(useTerminalStore.getState().fileStates['/a.arbo']).toBeDefined();
      expect(useTerminalStore.getState().fileStates['/a.arbo'].terminals).toHaveLength(0);
    });

    it('should cap terminal recreation at 5 per file', async () => {
      const manyTerminals = Array.from({ length: 10 }, (_, i) => ({
        title: `Terminal ${i}`, cwd: '/home',
      }));

      mockGetTerminalSession.mockResolvedValue({
        fileStates: {
          '/a.arbo': { terminals: manyTerminals, activeTerminalIndex: 0 },
        },
      });

      await useTerminalStore.getState().restoreTerminalSession();

      const pending = useTerminalStore.getState().fileStates['/a.arbo'].pendingRestore;
      expect(pending).toHaveLength(5);
    });
  });

  describe('originNodeId persistence', () => {
    it('saves originNodeId for each terminal entry', async () => {
      useTerminalStore.getState().setActiveFile('/a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-1', title: 'Terminal', cwd: '/home/user',
        shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
        originNodeId: 'node-origin',
      });

      await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());
      const lastCall = mockSaveTerminalSession.mock.calls[mockSaveTerminalSession.mock.calls.length - 1][0];
      expect(lastCall.fileStates['/a.arbo'].terminals[0]).toEqual(
        expect.objectContaining({ originNodeId: 'node-origin' }),
      );
    });

    it('omits originNodeId from the saved entry when the terminal has no origin', async () => {
      useTerminalStore.getState().setActiveFile('/a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-1', title: 'Terminal', cwd: '/home/user',
        shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      await vi.waitFor(() => expect(mockSaveTerminalSession).toHaveBeenCalled());
      const lastCall = mockSaveTerminalSession.mock.calls[mockSaveTerminalSession.mock.calls.length - 1][0];
      const saved = lastCall.fileStates['/a.arbo'].terminals[0];
      expect(saved.originNodeId).toBeUndefined();
    });

    it('restoreTerminalSession carries originNodeId into pendingRestore', async () => {
      mockGetTerminalSession.mockResolvedValue({
        fileStates: {
          '/a.arbo': {
            terminals: [
              { title: 'Terminal', cwd: '/home/user', originNodeId: 'node-A' },
              { title: 'Build', cwd: '/proj', originNodeId: 'node-B' },
            ],
            activeTerminalIndex: 0,
          },
        },
      });

      await useTerminalStore.getState().restoreTerminalSession();

      const pending = useTerminalStore.getState().fileStates['/a.arbo'].pendingRestore;
      expect(pending?.[0]).toEqual(
        expect.objectContaining({ originNodeId: 'node-A' }),
      );
      expect(pending?.[1]).toEqual(
        expect.objectContaining({ originNodeId: 'node-B' }),
      );
    });

    it('materializeRestoredTerminals propagates originNodeId onto the recreated TerminalInfo', async () => {
      useTerminalStore.setState({
        currentFilePath: '/a.arbo',
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/a.arbo': {
            terminals: [],
            activeTerminalId: null,
            pendingRestore: [
              { title: 'Terminal', cwd: '/home/user', originNodeId: 'node-origin' },
            ],
          },
        },
      });

      await useTerminalStore.getState().materializeRestoredTerminals();

      expect(useTerminalStore.getState().terminals[0].originNodeId).toBe('node-origin');
    });

    it('restores a legacy saved session that has no originNodeId field on its entries', async () => {
      mockGetTerminalSession.mockResolvedValue({
        fileStates: {
          '/a.arbo': {
            terminals: [{ title: 'Terminal', cwd: '/home/user' }],
            activeTerminalIndex: 0,
          },
        },
      });

      await expect(
        useTerminalStore.getState().restoreTerminalSession(),
      ).resolves.not.toThrow();

      const pending = useTerminalStore.getState().fileStates['/a.arbo'].pendingRestore;
      expect(pending).toHaveLength(1);
      expect(pending?.[0].originNodeId).toBeUndefined();
    });
  });
});
