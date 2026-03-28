import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTerminalStore } from '../terminalStore';

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

const mockTerminalDestroy = vi.fn().mockResolvedValue(undefined);

describe('per-file terminal instances', () => {
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
      terminalDestroy: mockTerminalDestroy,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  describe('per-file terminal scoping', () => {
    it('should add terminal to the current file pool only', () => {
      useTerminalStore.getState().setActiveFile('/project-a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-a', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      expect(useTerminalStore.getState().terminals).toHaveLength(1);
      expect(useTerminalStore.getState().terminals[0].id).toBe('term-a');

      useTerminalStore.getState().setActiveFile('/project-b.arbo');
      expect(useTerminalStore.getState().terminals).toHaveLength(0);
    });

    it('should not show file A terminals when switched to file B', () => {
      useTerminalStore.getState().setActiveFile('/project-a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-a', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      useTerminalStore.getState().setActiveFile('/project-b.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-b', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      expect(useTerminalStore.getState().terminals).toHaveLength(1);
      expect(useTerminalStore.getState().terminals[0].id).toBe('term-b');

      useTerminalStore.getState().setActiveFile('/project-a.arbo');
      expect(useTerminalStore.getState().terminals).toHaveLength(1);
      expect(useTerminalStore.getState().terminals[0].id).toBe('term-a');
    });

    it('should start with empty terminal pool for a new file', () => {
      useTerminalStore.getState().setActiveFile('/new-project.arbo');
      expect(useTerminalStore.getState().terminals).toHaveLength(0);
      expect(useTerminalStore.getState().activeTerminalId).toBeNull();
    });

    it('should allow same terminal title in different files', () => {
      useTerminalStore.getState().setActiveFile('/project-a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-a', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      useTerminalStore.getState().setActiveFile('/project-b.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-b', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      expect(useTerminalStore.getState().terminals[0].title).toBe('Terminal');
      useTerminalStore.getState().setActiveFile('/project-a.arbo');
      expect(useTerminalStore.getState().terminals[0].title).toBe('Terminal');
    });

    it('should remove terminal from current file only', () => {
      useTerminalStore.getState().setActiveFile('/project-a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-a', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      useTerminalStore.getState().setActiveFile('/project-b.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-b', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      useTerminalStore.getState().removeTerminal('term-b');
      expect(useTerminalStore.getState().terminals).toHaveLength(0);

      useTerminalStore.getState().setActiveFile('/project-a.arbo');
      expect(useTerminalStore.getState().terminals).toHaveLength(1);
    });
  });

  describe('file switching via setActiveFile', () => {
    it('should change which file terminals are returned for', () => {
      useTerminalStore.getState().setActiveFile('/a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-a', title: 'Terminal A', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      useTerminalStore.getState().setActiveFile('/b.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-b', title: 'Terminal B', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      useTerminalStore.getState().setActiveFile('/a.arbo');
      expect(useTerminalStore.getState().activeTerminalId).toBe('term-a');

      useTerminalStore.getState().setActiveFile('/b.arbo');
      expect(useTerminalStore.getState().activeTerminalId).toBe('term-b');
    });

    it('should return empty terminals for a file with none', () => {
      useTerminalStore.getState().setActiveFile('/empty.arbo');
      expect(useTerminalStore.getState().terminals).toEqual([]);
    });

    it('should return null activeTerminalId when no file is active', () => {
      useTerminalStore.getState().setActiveFile(null);
      expect(useTerminalStore.getState().terminals).toEqual([]);
      expect(useTerminalStore.getState().activeTerminalId).toBeNull();
    });
  });

  describe('zoom tab resolution', () => {
    it('should resolve zoom path to parent file terminals', () => {
      useTerminalStore.getState().setActiveFile('/project-a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-a', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      useTerminalStore.getState().setActiveFile('zoom:///project-a.arbo#node-1');
      expect(useTerminalStore.getState().terminals).toHaveLength(1);
      expect(useTerminalStore.getState().terminals[0].id).toBe('term-a');
    });

    it('should add terminal to parent file from zoom tab', () => {
      useTerminalStore.getState().setActiveFile('zoom:///project-a.arbo#node-1');
      useTerminalStore.getState().addTerminal({
        id: 'term-zoom', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      useTerminalStore.getState().setActiveFile('/project-a.arbo');
      expect(useTerminalStore.getState().terminals).toHaveLength(1);
      expect(useTerminalStore.getState().terminals[0].id).toBe('term-zoom');
    });
  });

  describe('closeFileTerminals', () => {
    it('should destroy all PTY processes for the specified file', async () => {
      useTerminalStore.getState().setActiveFile('/project-a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-1', title: 'Terminal 1', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });
      useTerminalStore.getState().addTerminal({
        id: 'term-2', title: 'Terminal 2', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      await useTerminalStore.getState().closeFileTerminals('/project-a.arbo');

      expect(mockTerminalDestroy).toHaveBeenCalledWith('term-1');
      expect(mockTerminalDestroy).toHaveBeenCalledWith('term-2');
    });

    it('should remove terminal entries for the specified file', async () => {
      useTerminalStore.getState().setActiveFile('/project-a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-a', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      await useTerminalStore.getState().closeFileTerminals('/project-a.arbo');

      useTerminalStore.getState().setActiveFile('/project-a.arbo');
      expect(useTerminalStore.getState().terminals).toHaveLength(0);
    });

    it('should not affect other files terminals', async () => {
      useTerminalStore.getState().setActiveFile('/project-a.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-a', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      useTerminalStore.getState().setActiveFile('/project-b.arbo');
      useTerminalStore.getState().addTerminal({
        id: 'term-b', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      await useTerminalStore.getState().closeFileTerminals('/project-a.arbo');

      useTerminalStore.getState().setActiveFile('/project-b.arbo');
      expect(useTerminalStore.getState().terminals).toHaveLength(1);
      expect(useTerminalStore.getState().terminals[0].id).toBe('term-b');
    });

    it('should be a no-op for a file with no terminals', async () => {
      await useTerminalStore.getState().closeFileTerminals('/empty.arbo');
      expect(mockTerminalDestroy).not.toHaveBeenCalled();
    });
  });

  describe('mutations with no active file', () => {
    it('should be a no-op when adding terminal with no active file', () => {
      useTerminalStore.getState().setActiveFile(null);
      useTerminalStore.getState().addTerminal({
        id: 'orphan', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [], pinnedToBottom: true,
      });

      expect(useTerminalStore.getState().terminals).toHaveLength(0);
    });
  });
});
