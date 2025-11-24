import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTerminalActions } from '../useTerminalActions';
import { TreeNode } from '../../../../../shared/types';
import { useTerminalStore } from '../../../../store/terminal/terminalStore';

// Mock logger
vi.mock('../../../../services/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock terminal service
vi.mock('../../../../services/terminalService', () => ({
  createTerminal: vi.fn().mockResolvedValue({
    id: 'auto-created-terminal',
    title: 'Terminal',
    cwd: '/home/user',
    shellCommand: '/bin/bash',
    shellArgs: [],
  }),
}));

describe('useTerminalActions', () => {
  const mockNode: TreeNode = {
    id: 'test-node',
    content: '# Test Command\necho "hello"',
    children: [],
    metadata: {},
  };

  const mockNodes: Record<string, TreeNode> = {
    'test-node': mockNode,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset terminal store state
    useTerminalStore.setState({
      terminals: [],
      activeTerminalId: null,
    });
  });

  describe('sendToTerminal', () => {
    it('should send formatted content to terminal', async () => {
      const mockTerminalWrite = vi.fn().mockResolvedValue(undefined);
      window.electron.terminalWrite = mockTerminalWrite;

      // Set up terminal store with active terminal
      useTerminalStore.setState({ activeTerminalId: 'terminal-1' });

      const { result } = renderHook(() => useTerminalActions());

      await result.current.sendToTerminal(mockNode, mockNodes);

      await waitFor(() => {
        expect(mockTerminalWrite).toHaveBeenCalledWith(
          'terminal-1',
          expect.stringContaining('# Test Command')
        );
        expect(mockTerminalWrite).toHaveBeenCalledWith(
          'terminal-1',
          expect.stringContaining('\n')
        );
      });
    });

    it('should auto-create terminal when none exists', async () => {
      const mockTerminalWrite = vi.fn().mockResolvedValue(undefined);
      window.electron.terminalWrite = mockTerminalWrite;

      // No active terminal set

      const { result } = renderHook(() => useTerminalActions());

      await result.current.sendToTerminal(mockNode, mockNodes);

      await waitFor(() => {
        expect(mockTerminalWrite).toHaveBeenCalledWith(
          'auto-created-terminal',
          expect.stringContaining('# Test Command')
        );
      });
    });

    it('should handle errors gracefully', async () => {
      const mockTerminalWrite = vi.fn().mockRejectedValue(new Error('Write failed'));
      window.electron.terminalWrite = mockTerminalWrite;

      // Set up terminal store with active terminal
      useTerminalStore.setState({ activeTerminalId: 'terminal-1' });

      const { result } = renderHook(() => useTerminalActions());

      await result.current.sendToTerminal(mockNode, mockNodes);

      await waitFor(() => {
        expect(mockTerminalWrite).toHaveBeenCalled();
      });
    });
  });

  describe('executeInTerminal', () => {
    it('should send content without newline and dispatch Enter key', async () => {
      const mockTerminalWrite = vi.fn().mockResolvedValue(undefined);
      window.electron.terminalWrite = mockTerminalWrite;

      // Set up terminal store with active terminal
      useTerminalStore.setState({ activeTerminalId: 'terminal-1' });

      // Mock querySelector to return a mock textarea
      const mockTextarea = document.createElement('textarea');
      mockTextarea.className = 'xterm-helper-textarea';
      const dispatchEventSpy = vi.spyOn(mockTextarea, 'dispatchEvent');
      const querySelectorSpy = vi
        .spyOn(document, 'querySelector')
        .mockReturnValue(mockTextarea);

      const { result } = renderHook(() => useTerminalActions());

      await result.current.executeInTerminal(mockNode, mockNodes);

      await waitFor(() => {
        // Should write content without extra newline
        expect(mockTerminalWrite).toHaveBeenCalledWith(
          'terminal-1',
          expect.not.stringContaining('\n\n')
        );
        // Should dispatch Enter key event
        expect(dispatchEventSpy).toHaveBeenCalledWith(
          expect.objectContaining({
            key: 'Enter',
            code: 'Enter',
          })
        );
      });

      querySelectorSpy.mockRestore();
    });

    it('should not execute empty content', async () => {
      const mockTerminalWrite = vi.fn().mockResolvedValue(undefined);
      window.electron.terminalWrite = mockTerminalWrite;

      // Set up terminal store with active terminal
      useTerminalStore.setState({ activeTerminalId: 'terminal-1' });

      const emptyNode: TreeNode = {
        id: 'empty',
        content: '',
        children: [],
        metadata: {},
      };

      const { result } = renderHook(() => useTerminalActions());

      await result.current.executeInTerminal(emptyNode, { empty: emptyNode });

      expect(mockTerminalWrite).not.toHaveBeenCalled();
    });

    it('should auto-create terminal when none exists', async () => {
      const mockTerminalWrite = vi.fn().mockResolvedValue(undefined);
      window.electron.terminalWrite = mockTerminalWrite;

      // Mock querySelector to return a mock textarea
      const mockTextarea = document.createElement('textarea');
      mockTextarea.className = 'xterm-helper-textarea';
      vi.spyOn(document, 'querySelector').mockReturnValue(mockTextarea);

      // No active terminal set

      const { result } = renderHook(() => useTerminalActions());

      await result.current.executeInTerminal(mockNode, mockNodes);

      await waitFor(() => {
        expect(mockTerminalWrite).toHaveBeenCalled();
      });
    });
  });
});
