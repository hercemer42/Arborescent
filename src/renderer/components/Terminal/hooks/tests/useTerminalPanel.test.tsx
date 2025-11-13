import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTerminalPanel } from '../useTerminalPanel';
import { useTerminalStore } from '../../../../store/terminal/terminalStore';

// Mock the terminal store
vi.mock('../../../../store/terminal/terminalStore');

// Mock logger
vi.mock('../../../../services/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe('useTerminalPanel', () => {
  const mockAddTerminal = vi.fn();
  const mockRemoveTerminal = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup terminal store mock
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      terminals: [],
      addTerminal: mockAddTerminal,
      removeTerminal: mockRemoveTerminal,
    });
  });

  describe('handleNewTerminal', () => {
    it('should create a new terminal and add it to store', async () => {
      const mockTerminalInfo = {
        id: 'terminal-123',
        title: 'Terminal 1',
        cwd: '/home/user',
        shellCommand: 'bash',
        shellArgs: [],
      };

      window.electron.terminalCreate = vi.fn().mockResolvedValue(mockTerminalInfo);

      const { result } = renderHook(() => useTerminalPanel());

      await result.current.handleNewTerminal();

      await waitFor(() => {
        expect(window.electron.terminalCreate).toHaveBeenCalledWith(
          expect.stringMatching(/terminal-\d+/),
          'Terminal 1'
        );
        expect(mockAddTerminal).toHaveBeenCalledWith(mockTerminalInfo);
      });
    });

    it('should handle errors when creating terminal fails', async () => {
      window.electron.terminalCreate = vi
        .fn()
        .mockRejectedValue(new Error('Failed to create'));

      const { result } = renderHook(() => useTerminalPanel());

      await result.current.handleNewTerminal();

      await waitFor(() => {
        expect(window.electron.terminalCreate).toHaveBeenCalled();
        expect(mockAddTerminal).not.toHaveBeenCalled();
      });
    });

    it('should generate correct terminal title based on count', async () => {
      const mockTerminalInfo = {
        id: 'terminal-123',
        title: 'Terminal 3',
        cwd: '/home/user',
        shellCommand: 'bash',
        shellArgs: [],
      };

      window.electron.terminalCreate = vi.fn().mockResolvedValue(mockTerminalInfo);

      // Mock store with existing terminals
      (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
        terminals: [{ id: 'term-1' }, { id: 'term-2' }],
        addTerminal: mockAddTerminal,
        removeTerminal: mockRemoveTerminal,
      });

      const { result } = renderHook(() => useTerminalPanel());

      await result.current.handleNewTerminal();

      await waitFor(() => {
        expect(window.electron.terminalCreate).toHaveBeenCalledWith(
          expect.any(String),
          'Terminal 3'
        );
      });
    });
  });

  describe('handleCloseTerminal', () => {
    it('should destroy terminal and remove from store', async () => {
      window.electron.terminalDestroy = vi.fn().mockResolvedValue(undefined);

      const { result } = renderHook(() => useTerminalPanel());

      await result.current.handleCloseTerminal('terminal-123');

      await waitFor(() => {
        expect(window.electron.terminalDestroy).toHaveBeenCalledWith('terminal-123');
        expect(mockRemoveTerminal).toHaveBeenCalledWith('terminal-123');
      });
    });

    it('should handle errors when destroying terminal fails', async () => {
      window.electron.terminalDestroy = vi
        .fn()
        .mockRejectedValue(new Error('Failed to destroy'));

      const { result } = renderHook(() => useTerminalPanel());

      await result.current.handleCloseTerminal('terminal-123');

      await waitFor(() => {
        expect(window.electron.terminalDestroy).toHaveBeenCalled();
        expect(mockRemoveTerminal).not.toHaveBeenCalled();
      });
    });
  });
});
