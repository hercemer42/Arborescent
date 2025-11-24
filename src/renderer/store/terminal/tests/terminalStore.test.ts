import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useTerminalStore } from '../terminalStore';
import { TreeNode } from '../../../../shared/types';

// Mock logger
vi.mock('../../../services/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock terminal service
vi.mock('../../../services/terminalService', () => ({
  createTerminal: vi.fn().mockResolvedValue({
    id: 'new-terminal-1',
    title: 'Terminal',
    cwd: '/home/user',
    shellCommand: '/bin/bash',
    shellArgs: [],
  }),
}));

describe('terminalStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset terminal store state
    useTerminalStore.setState({
      terminals: [],
      activeTerminalId: null,
    });
  });

  describe('openTerminal', () => {
    it('should return existing terminal ID if one exists', async () => {
      useTerminalStore.setState({
        terminals: [{ id: 'existing-terminal', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [] }],
        activeTerminalId: 'existing-terminal',
      });

      const terminalId = await useTerminalStore.getState().openTerminal();

      expect(terminalId).toBe('existing-terminal');
    });

    it('should create a new terminal if none exists', async () => {
      const terminalId = await useTerminalStore.getState().openTerminal();

      expect(terminalId).toBe('new-terminal-1');
      expect(useTerminalStore.getState().activeTerminalId).toBe('new-terminal-1');
      expect(useTerminalStore.getState().terminals).toHaveLength(1);
    });

    it('should return null if terminal creation fails', async () => {
      const { createTerminal } = await import('../../../services/terminalService');
      vi.mocked(createTerminal).mockRejectedValueOnce(new Error('Failed to create'));

      const terminalId = await useTerminalStore.getState().openTerminal();

      expect(terminalId).toBeNull();
    });
  });

  describe('sendNodeToTerminal', () => {
    const mockNode: TreeNode = {
      id: 'test-node',
      content: 'echo "hello"',
      children: [],
      metadata: {},
    };

    it('should auto-create terminal if none exists', async () => {
      const mockTerminalWrite = vi.fn().mockResolvedValue(undefined);
      window.electron.terminalWrite = mockTerminalWrite;

      await useTerminalStore.getState().sendNodeToTerminal(mockNode, { 'test-node': mockNode });

      expect(useTerminalStore.getState().activeTerminalId).toBe('new-terminal-1');
      expect(mockTerminalWrite).toHaveBeenCalledWith('new-terminal-1', expect.stringContaining('echo "hello"'));
    });

    it('should use existing terminal if available', async () => {
      const mockTerminalWrite = vi.fn().mockResolvedValue(undefined);
      window.electron.terminalWrite = mockTerminalWrite;

      useTerminalStore.setState({
        terminals: [{ id: 'existing-terminal', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [] }],
        activeTerminalId: 'existing-terminal',
      });

      await useTerminalStore.getState().sendNodeToTerminal(mockNode, { 'test-node': mockNode });

      expect(mockTerminalWrite).toHaveBeenCalledWith('existing-terminal', expect.stringContaining('echo "hello"'));
    });
  });

  describe('executeNodeInTerminal', () => {
    const mockNode: TreeNode = {
      id: 'test-node',
      content: 'echo "hello"',
      children: [],
      metadata: {},
    };

    beforeEach(() => {
      // Mock querySelector for xterm textarea
      const mockTextarea = document.createElement('textarea');
      vi.spyOn(document, 'querySelector').mockReturnValue(mockTextarea);
    });

    it('should auto-create terminal if none exists', async () => {
      const mockTerminalWrite = vi.fn().mockResolvedValue(undefined);
      window.electron.terminalWrite = mockTerminalWrite;

      await useTerminalStore.getState().executeNodeInTerminal(mockNode, { 'test-node': mockNode });

      expect(useTerminalStore.getState().activeTerminalId).toBe('new-terminal-1');
      expect(mockTerminalWrite).toHaveBeenCalled();
    });

    it('should use existing terminal if available', async () => {
      const mockTerminalWrite = vi.fn().mockResolvedValue(undefined);
      window.electron.terminalWrite = mockTerminalWrite;

      useTerminalStore.setState({
        terminals: [{ id: 'existing-terminal', title: 'Terminal', cwd: '/', shellCommand: '/bin/bash', shellArgs: [] }],
        activeTerminalId: 'existing-terminal',
      });

      await useTerminalStore.getState().executeNodeInTerminal(mockNode, { 'test-node': mockNode });

      expect(mockTerminalWrite).toHaveBeenCalled();
    });
  });
});
