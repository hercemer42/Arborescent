import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logger } from '../logger';
import { ToastType } from '../../components/Toast';

describe('Renderer Logger', () => {
  const mockToastCallback = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Clear any previous toast callback
    logger.setToastCallback(mockToastCallback);
  });

  describe('setToastCallback', () => {
    it('should set toast callback', () => {
      const callback = vi.fn();
      logger.setToastCallback(callback);

      logger.error('Test error', undefined, undefined, true);

      expect(callback).toHaveBeenCalledWith('Test error', 'error');
    });

    it('should replace existing callback', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      logger.setToastCallback(callback1);
      logger.setToastCallback(callback2);

      logger.error('Test error', undefined, undefined, true);

      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).toHaveBeenCalledWith('Test error', 'error');
    });
  });

  describe('warn', () => {
    it('should log warning without toast by default', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logger.warn('Test warning');

      expect(mockToastCallback).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log warning without toast when showToast is false', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logger.warn('Test warning', 'Context', false);

      expect(mockToastCallback).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should show toast when showToast is true', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logger.warn('Test warning', 'Context', true);

      expect(mockToastCallback).toHaveBeenCalledWith('Test warning', 'warning');
      consoleSpy.mockRestore();
    });

    it('should not show toast if callback not set', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      logger.setToastCallback(undefined as unknown as (message: string, type: ToastType) => void);

      logger.warn('Test warning', 'Context', true);

      expect(mockToastCallback).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log to console', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      logger.warn('Test warning', 'TestContext');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('error', () => {
    it('should log error with toast by default', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.error('Test error');

      expect(mockToastCallback).toHaveBeenCalledWith('Test error', 'error');
      consoleSpy.mockRestore();
    });

    it('should log error without toast when showToast is false', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.error('Test error', undefined, undefined, false);

      expect(mockToastCallback).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log error with Error object', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Test error object');

      logger.error('Error occurred', error, 'TestContext', true);

      expect(mockToastCallback).toHaveBeenCalledWith('Error occurred', 'error');
      consoleSpy.mockRestore();
    });

    it('should log error with context', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.error('Test error', undefined, 'ErrorContext', true);

      expect(mockToastCallback).toHaveBeenCalledWith('Test error', 'error');
      consoleSpy.mockRestore();
    });

    it('should not show toast if callback not set', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      logger.setToastCallback(undefined as unknown as (message: string, type: ToastType) => void);

      logger.error('Test error', undefined, undefined, true);

      expect(mockToastCallback).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log to console', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      logger.error('Test error', undefined, 'ErrorContext');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('success', () => {
    it('should log success with toast by default', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.success('Operation successful');

      expect(mockToastCallback).toHaveBeenCalledWith('Operation successful', 'success');
      consoleSpy.mockRestore();
    });

    it('should log success without toast when showToast is false', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.success('Operation successful', 'Context', false);

      expect(mockToastCallback).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log success with context', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.success('Operation successful', 'SuccessContext', true);

      expect(mockToastCallback).toHaveBeenCalledWith('Operation successful', 'success');
      consoleSpy.mockRestore();
    });

    it('should not show toast if callback not set', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      logger.setToastCallback(undefined as unknown as (message: string, type: ToastType) => void);

      logger.success('Operation successful', undefined, true);

      expect(mockToastCallback).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should log to console as info level', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.success('Operation successful', 'SuccessContext');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe('integration', () => {
    it('should handle multiple log calls with different types', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.warn('Warning message', 'Context', true);
      logger.error('Error message', undefined, 'Context', true);
      logger.success('Success message', 'Context', true);

      expect(mockToastCallback).toHaveBeenCalledTimes(3);
      expect(mockToastCallback).toHaveBeenCalledWith('Warning message', 'warning');
      expect(mockToastCallback).toHaveBeenCalledWith('Error message', 'error');
      expect(mockToastCallback).toHaveBeenCalledWith('Success message', 'success');

      consoleWarnSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
    });

    it('should work with inherited BaseLogger methods', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      logger.info('Info message', 'Context');

      // info method should not trigger toast (it's from BaseLogger)
      expect(mockToastCallback).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
