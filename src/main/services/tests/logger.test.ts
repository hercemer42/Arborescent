import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, setElectronModule } from '../logger';

describe('MainLogger', () => {
  let mockWindow: {
    webContents: {
      send: ReturnType<typeof vi.fn>;
    };
  };
  let mockGetAllWindows: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    mockWindow = {
      webContents: {
        send: vi.fn(),
      },
    };

    mockGetAllWindows = vi.fn();

    // Inject mock electron module
    setElectronModule({
      BrowserWindow: {
        getAllWindows: mockGetAllWindows,
      },
    } as unknown as typeof import('electron'));

    // Mock console methods to suppress output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'info').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Reset electron module
    setElectronModule(null);
  });

  describe('error', () => {
    it('should log error with message and context', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');
      mockGetAllWindows.mockReturnValue([]);

      logger.error('Test error', undefined, 'Test Context');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Test Context] Test error');
    });

    it('should send error to renderer by default', () => {
      mockGetAllWindows.mockReturnValue([mockWindow]);

      logger.error('Test error');

      expect(mockWindow.webContents.send).toHaveBeenCalledWith('main-error', 'Test error');
    });

    it('should not send to renderer when notifyRenderer is false', () => {
      mockGetAllWindows.mockReturnValue([mockWindow]);

      logger.error('Test error', undefined, undefined, false);

      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should handle no windows available', () => {
      mockGetAllWindows.mockReturnValue([]);

      // Should not throw
      expect(() => logger.error('Test error')).not.toThrow();
      expect(mockWindow.webContents.send).not.toHaveBeenCalled();
    });

    it('should log error with Error object', () => {
      const consoleErrorSpy = vi.spyOn(console, 'error');
      const error = new Error('Something went wrong');
      mockGetAllWindows.mockReturnValue([]);

      logger.error('Test error', error, 'Test Context');

      expect(consoleErrorSpy).toHaveBeenCalledWith('[Test Context] Test error', error);
    });

    it('should send error to first window when multiple windows exist', () => {
      const mockWindow2 = {
        webContents: {
          send: vi.fn(),
        },
      };

      mockGetAllWindows.mockReturnValue([mockWindow, mockWindow2]);

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
