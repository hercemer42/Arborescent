import { describe, it, expect, vi, beforeEach } from 'vitest';

const appendLogMock: ReturnType<typeof vi.fn> = vi.fn().mockResolvedValue(undefined);

beforeEach(() => {
  vi.clearAllMocks();
  (window as unknown as { electron: { appendLog: typeof appendLogMock } }).electron = {
    appendLog: appendLogMock,
  };
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
});

describe('renderer logger → main IPC bridge', () => {
  describe('forwarding', () => {
    it('forwards info entries to main over electron.appendLog', async () => {
      const { logger } = await import('../logger');

      logger.info('hello main', 'WorkflowExecution');

      expect(appendLogMock).toHaveBeenCalledWith(
        expect.objectContaining({
          level: 'info',
          message: 'hello main',
          context: 'WorkflowExecution',
        }),
      );
    });

    it('passes the nodeId metadata through the IPC payload', async () => {
      const { logger } = await import('../logger');

      logger.info('with node', 'WorkflowExecution', { nodeId: 'node-9' });

      expect(appendLogMock).toHaveBeenCalledWith(
        expect.objectContaining({ nodeId: 'node-9' }),
      );
    });

    it('omits nodeId from the payload when not provided', async () => {
      const { logger } = await import('../logger');

      logger.warn('no node', 'WorkflowExecution');

      const lastCall = appendLogMock.mock.calls[appendLogMock.mock.calls.length - 1];
      expect(lastCall?.[0]).toEqual(
        expect.objectContaining({ level: 'warn', nodeId: undefined }),
      );
    });
  });

  describe('non-blocking behaviour', () => {
    it('does not throw when the IPC call rejects', async () => {
      appendLogMock.mockReturnValueOnce(Promise.reject(new Error('IPC down')));
      const { logger } = await import('../logger');

      expect(() => logger.info('after reject', 'A')).not.toThrow();
    });

    it('is a no-op when window.electron is unavailable', async () => {
      (window as unknown as { electron?: unknown }).electron = undefined;
      const { logger } = await import('../logger');

      expect(() => logger.info('no bridge', 'A')).not.toThrow();
    });
  });
});
