import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrowserWindow } from 'electron';
import { logger } from '../logger';

vi.mock('electron', () => ({
  BrowserWindow: {
    getAllWindows: vi.fn(),
  },
}));

describe('MainLogger', () => {
  let mockWindow: {
    webContents: {
      send: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockWindow = {
      webContents: {
        send: vi.fn(),
      },
    };

    // Mock console methods to suppress output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  describe('error', () => {
    it('should log error with message and context', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

      logger.error('Test error', undefined, 'Test Context');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Test Context] Test error');
    });

    it('should send error to renderer by default', () => {
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWindow] as unknown as BrowserWindow[]);

      logger.error('Test error');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('main-error', 'Test error');
    });

    it('should not send to renderer when notifyRenderer is false', () => {
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([mockWindow] as unknown as BrowserWindow[]);

      logger.error('Test error', undefined, undefined, false);

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should handle no windows available', () => {
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

      // Should not throw
      expect(() => logger.error('Test error')).not.toThrow();
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should log error with Error object', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');
      const error = new Error('Something went wrong');
      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([]);

      logger.error('Test error', error, 'Test Context');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Test Context] Test error', error);
    });

    it('should send error to first window when multiple windows exist', () => {
      const mockWindow2 = {
        webContents: {
          send: vi.fn(),
        },
      };

      vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
        mockWindow,
        mockWindow2,
      ] as unknown as BrowserWindow[]);

      logger.error('Test error');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('main-error', 'Test error');
      expect(mockWindow2.webContents.send).not.toHaveBeenCalled();
    });
  });

  describe('inherited methods', () => {
    it('should support info logging', () => {
      const consoleLogSpy = vi.spyOn(console, 'log');

      logger.info('Test info', 'Test Context');

      expect(consoleLogSpy).toHaveBeenCalledWith('[Test Context] Test info');
    });

    it('should support warn logging', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn');

      logger.warn('Test warning', 'Test Context');

      expect(consoleWarnSpy).toHaveBeenCalledWith('[Test Context] Test warning');
    });
  });
});
