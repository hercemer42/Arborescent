import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTerminalStore } from '../terminalStore';

vi.mock('../../../services/logger', () => ({
  logger: { error: vi.fn(), info: vi.fn() },
}));

vi.mock('../../../services/terminalService', () => ({
  createTerminal: vi.fn().mockResolvedValue({
    id: 'new-terminal',
    title: 'Terminal',
    cwd: '/',
    shellCommand: '/bin/bash',
    shellArgs: [],
    pinnedToBottom: true,
  }),
}));

vi.mock('../../../services/storageService', () => ({
  StorageService: vi.fn().mockImplementation(() => ({
    saveTerminalSession: vi.fn().mockResolvedValue(undefined),
    getTerminalSession: vi.fn().mockResolvedValue(null),
  })),
}));

function makeTerminal(id: string, title = 'Terminal') {
  return {
    id,
    title,
    cwd: '/',
    shellCommand: '/bin/bash',
    shellArgs: [] as string[],
    pinnedToBottom: true,
  };
}

describe('terminalStore — setActiveTerminal and setActiveFile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useTerminalStore.setState({
      terminals: [],
      activeTerminalId: null,
      currentFilePath: '/project.arbo',
      fileStates: {
        '/project.arbo': { terminals: [], activeTerminalId: null },
      },
    });
  });

  describe('setActiveTerminal', () => {
    it('updates activeTerminalId to the specified terminal', () => {
      useTerminalStore.setState({
        terminals: [makeTerminal('t1'), makeTerminal('t2')],
        activeTerminalId: 't1',
        fileStates: {
          '/project.arbo': {
            terminals: [makeTerminal('t1'), makeTerminal('t2')],
            activeTerminalId: 't1',
          },
        },
      });

      useTerminalStore.getState().setActiveTerminal('t2');

      expect(useTerminalStore.getState().activeTerminalId).toBe('t2');
    });

    it('persists the updated activeTerminalId to fileStates for the current file', () => {
      useTerminalStore.setState({
        terminals: [makeTerminal('t1'), makeTerminal('t2')],
        activeTerminalId: 't1',
        fileStates: {
          '/project.arbo': {
            terminals: [makeTerminal('t1'), makeTerminal('t2')],
            activeTerminalId: 't1',
          },
        },
      });

      useTerminalStore.getState().setActiveTerminal('t2');

      expect(useTerminalStore.getState().fileStates['/project.arbo'].activeTerminalId).toBe('t2');
    });

    it('allows setting activeTerminalId to null', () => {
      useTerminalStore.setState({
        terminals: [makeTerminal('t1')],
        activeTerminalId: 't1',
        fileStates: {
          '/project.arbo': { terminals: [makeTerminal('t1')], activeTerminalId: 't1' },
        },
      });

      useTerminalStore.getState().setActiveTerminal(null);

      expect(useTerminalStore.getState().activeTerminalId).toBeNull();
      expect(useTerminalStore.getState().fileStates['/project.arbo'].activeTerminalId).toBeNull();
    });

    it('is a no-op when currentFilePath is null (no file open)', () => {
      useTerminalStore.setState({
        terminals: [makeTerminal('t1')],
        activeTerminalId: 't1',
        currentFilePath: null,
        fileStates: {},
      });

      useTerminalStore.getState().setActiveTerminal('t2');

      // State should be unchanged — there is no file to update
      expect(useTerminalStore.getState().activeTerminalId).toBe('t1');
    });

    it('does not alter fileStates for other open files', () => {
      useTerminalStore.setState({
        currentFilePath: '/file-a.arbo',
        terminals: [makeTerminal('t1')],
        activeTerminalId: 't1',
        fileStates: {
          '/file-a.arbo': { terminals: [makeTerminal('t1')], activeTerminalId: 't1' },
          '/file-b.arbo': { terminals: [makeTerminal('t2')], activeTerminalId: 't2' },
        },
      });

      useTerminalStore.getState().setActiveTerminal('t3');

      expect(useTerminalStore.getState().fileStates['/file-b.arbo'].activeTerminalId).toBe('t2');
    });

    it('handles switching to the same terminal that is already active', () => {
      useTerminalStore.setState({
        terminals: [makeTerminal('t1'), makeTerminal('t2')],
        activeTerminalId: 't1',
        fileStates: {
          '/project.arbo': {
            terminals: [makeTerminal('t1'), makeTerminal('t2')],
            activeTerminalId: 't1',
          },
        },
      });

      useTerminalStore.getState().setActiveTerminal('t1');

      expect(useTerminalStore.getState().activeTerminalId).toBe('t1');
    });
  });

  describe('setActiveFile — restores per-file terminal state on file switch', () => {
    it('loads the terminals for the target file', () => {
      useTerminalStore.setState({
        currentFilePath: '/file-a.arbo',
        terminals: [makeTerminal('t1')],
        activeTerminalId: 't1',
        fileStates: {
          '/file-a.arbo': { terminals: [makeTerminal('t1')], activeTerminalId: 't1' },
          '/file-b.arbo': {
            terminals: [makeTerminal('t2'), makeTerminal('t3')],
            activeTerminalId: 't3',
          },
        },
      });

      useTerminalStore.getState().setActiveFile('/file-b.arbo');

      expect(useTerminalStore.getState().terminals).toHaveLength(2);
      expect(useTerminalStore.getState().terminals[0].id).toBe('t2');
      expect(useTerminalStore.getState().terminals[1].id).toBe('t3');
    });

    it('restores the activeTerminalId for the target file', () => {
      useTerminalStore.setState({
        currentFilePath: '/file-a.arbo',
        terminals: [makeTerminal('t1')],
        activeTerminalId: 't1',
        fileStates: {
          '/file-a.arbo': { terminals: [makeTerminal('t1')], activeTerminalId: 't1' },
          '/file-b.arbo': {
            terminals: [makeTerminal('t2'), makeTerminal('t3')],
            activeTerminalId: 't3',
          },
        },
      });

      useTerminalStore.getState().setActiveFile('/file-b.arbo');

      expect(useTerminalStore.getState().activeTerminalId).toBe('t3');
    });

    it('updates currentFilePath to the new file', () => {
      useTerminalStore.setState({
        currentFilePath: '/file-a.arbo',
        terminals: [],
        activeTerminalId: null,
        fileStates: {
          '/file-a.arbo': { terminals: [], activeTerminalId: null },
          '/file-b.arbo': { terminals: [], activeTerminalId: null },
        },
      });

      useTerminalStore.getState().setActiveFile('/file-b.arbo');

      expect(useTerminalStore.getState().currentFilePath).toBe('/file-b.arbo');
    });

    it('switching files and switching back fully restores the original file state', () => {
      useTerminalStore.setState({
        currentFilePath: '/file-a.arbo',
        terminals: [makeTerminal('t1')],
        activeTerminalId: 't1',
        fileStates: {
          '/file-a.arbo': { terminals: [makeTerminal('t1')], activeTerminalId: 't1' },
          '/file-b.arbo': { terminals: [makeTerminal('t2')], activeTerminalId: 't2' },
        },
      });

      useTerminalStore.getState().setActiveFile('/file-b.arbo');
      expect(useTerminalStore.getState().activeTerminalId).toBe('t2');

      useTerminalStore.getState().setActiveFile('/file-a.arbo');

      expect(useTerminalStore.getState().activeTerminalId).toBe('t1');
      expect(useTerminalStore.getState().terminals).toHaveLength(1);
      expect(useTerminalStore.getState().terminals[0].id).toBe('t1');
    });

    it('shows an empty terminal list when switching to a file that has no terminals', () => {
      useTerminalStore.setState({
        currentFilePath: '/file-a.arbo',
        terminals: [makeTerminal('t1')],
        activeTerminalId: 't1',
        fileStates: {
          '/file-a.arbo': { terminals: [makeTerminal('t1')], activeTerminalId: 't1' },
          // /file-b.arbo has no entry — first time opening this file
        },
      });

      useTerminalStore.getState().setActiveFile('/file-b.arbo');

      expect(useTerminalStore.getState().terminals).toHaveLength(0);
      expect(useTerminalStore.getState().activeTerminalId).toBeNull();
    });

    it('handles switching to a null file path (no file open)', () => {
      useTerminalStore.setState({
        currentFilePath: '/file-a.arbo',
        terminals: [makeTerminal('t1')],
        activeTerminalId: 't1',
        fileStates: {
          '/file-a.arbo': { terminals: [makeTerminal('t1')], activeTerminalId: 't1' },
        },
      });

      useTerminalStore.getState().setActiveFile(null);

      expect(useTerminalStore.getState().terminals).toHaveLength(0);
      expect(useTerminalStore.getState().activeTerminalId).toBeNull();
      expect(useTerminalStore.getState().currentFilePath).toBeNull();
    });

    it('does not mutate terminals for files that were not switched to', () => {
      useTerminalStore.setState({
        currentFilePath: '/file-a.arbo',
        terminals: [makeTerminal('t1')],
        activeTerminalId: 't1',
        fileStates: {
          '/file-a.arbo': { terminals: [makeTerminal('t1')], activeTerminalId: 't1' },
          '/file-b.arbo': { terminals: [makeTerminal('t2')], activeTerminalId: 't2' },
          '/file-c.arbo': { terminals: [makeTerminal('t3')], activeTerminalId: 't3' },
        },
      });

      useTerminalStore.getState().setActiveFile('/file-b.arbo');

      // file-c must be untouched
      expect(useTerminalStore.getState().fileStates['/file-c.arbo'].activeTerminalId).toBe('t3');
      expect(useTerminalStore.getState().fileStates['/file-c.arbo'].terminals).toHaveLength(1);
    });
  });
});
