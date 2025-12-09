import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { executeInTerminal } from '../terminalExecution';
import { logger } from '../logger';

vi.mock('../logger', () => ({
  logger: {
    error: vi.fn(),
  },
}));

describe('terminalExecution', () => {
  let mockTerminalWrite: ReturnType<typeof vi.fn>;
  let mockTerminalElement: HTMLTextAreaElement;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock window.electron.terminalWrite
    mockTerminalWrite = vi.fn().mockResolvedValue(undefined);
    global.window = {
      electron: {
        terminalWrite: mockTerminalWrite,
      },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any;

    // Mock terminal DOM element
    mockTerminalElement = document.createElement('textarea');
    mockTerminalElement.className = 'xterm-helper-textarea';
    const terminalContainer = document.createElement('div');
    terminalContainer.className = 'terminal-container';
    terminalContainer.appendChild(mockTerminalElement);
    document.body.appendChild(terminalContainer);

    // Spy on methods
    vi.spyOn(mockTerminalElement, 'focus');
    vi.spyOn(mockTerminalElement, 'dispatchEvent');
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.useRealTimers();
  });

  describe('executeInTerminal', () => {
    it('should write content to terminal and execute', async () => {
      const content = 'echo hello';
      const executePromise = executeInTerminal('terminal-1', content);

      await vi.advanceTimersByTimeAsync(150);
      await executePromise;

      expect(mockTerminalWrite).toHaveBeenCalledWith('terminal-1', content);
      expect(mockTerminalElement.focus).toHaveBeenCalled();
      expect(mockTerminalElement.dispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'keydown',
          key: 'Enter',
          code: 'Enter',
          keyCode: 13,
          which: 13,
        })
      );
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

    it('should handle missing terminal element gracefully', async () => {
      document.body.innerHTML = '';

      const content = 'echo hello';
      const executePromise = executeInTerminal('terminal-1', content);

      await vi.advanceTimersByTimeAsync(150);
      await executePromise;

      expect(mockTerminalWrite).toHaveBeenCalledWith('terminal-1', content);
      expect(logger.error).not.toHaveBeenCalled();
    });

    it('should dispatch Enter key with correct properties', async () => {
      const content = 'ls -la';
      const executePromise = executeInTerminal('terminal-1', content);

      await vi.advanceTimersByTimeAsync(150);
      await executePromise;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dispatchedEvent = (mockTerminalElement.dispatchEvent as any).mock.calls[0][0];
      expect(dispatchedEvent).toBeInstanceOf(KeyboardEvent);
      expect(dispatchedEvent.key).toBe('Enter');
      expect(dispatchedEvent.code).toBe('Enter');
      expect(dispatchedEvent.keyCode).toBe(13);
      expect(dispatchedEvent.which).toBe(13);
      expect(dispatchedEvent.bubbles).toBe(true);
      expect(dispatchedEvent.cancelable).toBe(true);
    });
  });
});
