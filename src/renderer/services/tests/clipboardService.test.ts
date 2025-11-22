import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { writeToClipboard, readFromClipboard } from '../clipboardService';
import { logger } from '../logger';

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
  },
}));

describe('clipboardService', () => {
  const mockClipboard = {
    writeText: vi.fn(),
    readText: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'clipboard', {
      value: mockClipboard,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('writeToClipboard', () => {
    it('should write text to clipboard and return true on success', async () => {
      mockClipboard.writeText.mockResolvedValueOnce(undefined);

      const result = await writeToClipboard('test content', 'TestContext');

      expect(result).toBe(true);
      expect(mockClipboard.writeText).toHaveBeenCalledWith('test content');
      expect(logger.info).toHaveBeenCalledWith('Copied to clipboard', 'TestContext');
    });

    it('should return false and log error on failure', async () => {
      const error = new Error('Clipboard error');
      mockClipboard.writeText.mockRejectedValueOnce(error);

      const result = await writeToClipboard('test content', 'TestContext');

      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to write to clipboard',
        error,
        'TestContext'
      );
    });
  });

  describe('readFromClipboard', () => {
    it('should read text from clipboard and return it on success', async () => {
      mockClipboard.readText.mockResolvedValueOnce('clipboard content');

      const result = await readFromClipboard('TestContext');

      expect(result).toBe('clipboard content');
      expect(mockClipboard.readText).toHaveBeenCalled();
    });

    it('should return null and log error on failure', async () => {
      const error = new Error('Clipboard error');
      mockClipboard.readText.mockRejectedValueOnce(error);

      const result = await readFromClipboard('TestContext');

      expect(result).toBe(null);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to read from clipboard',
        error,
        'TestContext'
      );
    });

    it('should return empty string if clipboard is empty', async () => {
      mockClipboard.readText.mockResolvedValueOnce('');

      const result = await readFromClipboard('TestContext');

      expect(result).toBe('');
    });
  });
});
