import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useTerminalPanel } from '../useTerminalPanel';
import { useTerminalStore } from '../../../../store/terminal/terminalStore';

// Mock the terminal store
vi.mock('../../../../store/terminal/terminalStore');

describe('useTerminalPanel', () => {
  const mockCreateNewTerminal = vi.fn();
  const mockCloseTerminal = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const setupMock = (terminals: { id: string }[] = []) => {
    (useTerminalStore as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      (selector: (state: Record<string, unknown>) => unknown) => {
        const state = {
          terminals,
          createNewTerminal: mockCreateNewTerminal,
          closeTerminal: mockCloseTerminal,
        };
        return selector(state);
      }
    );
  };

  describe('handleNewTerminal', () => {
    it('should call createNewTerminal with correct title', async () => {
      setupMock([]);
      mockCreateNewTerminal.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTerminalPanel());

      await result.current.handleNewTerminal();

      await waitFor(() => {
        expect(mockCreateNewTerminal).toHaveBeenCalledWith('Terminal 1');
      });
    });

    it('should handle errors when creating terminal fails', async () => {
      setupMock([]);
      mockCreateNewTerminal.mockRejectedValue(new Error('Failed to create'));

      const { result } = renderHook(() => useTerminalPanel());

      // Should not throw
      await expect(result.current.handleNewTerminal()).rejects.toThrow('Failed to create');
    });

    it('should generate correct terminal title based on count', async () => {
      setupMock([{ id: 'term-1' }, { id: 'term-2' }]);
      mockCreateNewTerminal.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTerminalPanel());

      await result.current.handleNewTerminal();

      await waitFor(() => {
        expect(mockCreateNewTerminal).toHaveBeenCalledWith('Terminal 3');
      });
    });
  });

  describe('handleCloseTerminal', () => {
    it('should call closeTerminal with correct id', async () => {
      setupMock([]);
      mockCloseTerminal.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTerminalPanel());

      await result.current.handleCloseTerminal('terminal-123');

      await waitFor(() => {
        expect(mockCloseTerminal).toHaveBeenCalledWith('terminal-123');
      });
    });

    it('should handle errors when closing terminal fails', async () => {
      setupMock([]);
      mockCloseTerminal.mockRejectedValue(new Error('Failed to close'));

      const { result } = renderHook(() => useTerminalPanel());

      // Should not throw
      await expect(result.current.handleCloseTerminal('terminal-123')).rejects.toThrow('Failed to close');
    });
  });
});
