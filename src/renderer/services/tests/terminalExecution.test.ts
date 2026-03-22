import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeInTerminal } from '../terminalExecution';
import { logger } from '../logger';

vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('terminalExecution', () => {
  let mockTerminalWrite: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockTerminalWrite = vi.fn().mockResolvedValue(undefined);
    global.window = {
      electron: {
        terminalWrite: mockTerminalWrite,
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;
  });

  describe('executeInTerminal', () => {
    it('should write content wrapped in bracketed paste then send Enter', async () => {
      vi.useFakeTimers();

      const promise = executeInTerminal('terminal-1', 'echo hello');
      await vi.advanceTimersByTimeAsync(250);
      await promise;

      expect(mockTerminalWrite).toHaveBeenCalledTimes(2);
      expect(mockTerminalWrite).toHaveBeenNthCalledWith(1, 'terminal-1', '\x1b[200~echo hello\x1b[201~');
      expect(mockTerminalWrite).toHaveBeenNthCalledWith(2, 'terminal-1', '\r');

      vi.useRealTimers();
    });

    it('should not execute if content is empty', async () => {
      await executeInTerminal('terminal-1', '');

      expect(mockTerminalWrite).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'No content to execute',
        expect.any(Error),
        'Terminal Execution'
      );
    });

    it('should not execute if content is only whitespace', async () => {
      await executeInTerminal('terminal-1', '   \n\t  ');

      expect(mockTerminalWrite).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        'No content to execute',
        expect.any(Error),
        'Terminal Execution'
      );
    });
  });
});
