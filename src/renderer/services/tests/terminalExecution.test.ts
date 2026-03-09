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
    it('should write content with carriage return to terminal', async () => {
      await executeInTerminal('terminal-1', 'echo hello');

      expect(mockTerminalWrite).toHaveBeenCalledWith('terminal-1', 'echo hello\r');
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
