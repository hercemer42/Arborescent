import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockWatchFile, mockUnwatchFile, mockReadFile } = vi.hoisted(() => ({
  mockWatchFile: vi.fn(),
  mockUnwatchFile: vi.fn(),
  mockReadFile: vi.fn(),
}));

vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    default: { ...actual, watchFile: mockWatchFile, unwatchFile: mockUnwatchFile },
    watchFile: mockWatchFile,
    unwatchFile: mockUnwatchFile,
  };
});

vi.mock('fs/promises', async () => {
  const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
  return {
    ...actual,
    default: { ...actual, readFile: mockReadFile },
    readFile: mockReadFile,
  };
});

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { FeedbackFileWatcher } from '../feedbackFileWatcher';

describe('FeedbackFileWatcher', () => {
  let watcher: FeedbackFileWatcher;

  beforeEach(() => {
    vi.clearAllMocks();
    watcher = new FeedbackFileWatcher();
  });

  describe('multi-file support', () => {
    it('should watch multiple files concurrently with independent callbacks', () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();

      watcher.start('/tmp/file-1.md', callback1);
      watcher.start('/tmp/file-2.md', callback2);

      expect(mockWatchFile).toHaveBeenCalledTimes(2);
      expect(watcher.isWatching('/tmp/file-1.md')).toBe(true);
      expect(watcher.isWatching('/tmp/file-2.md')).toBe(true);
    });

    it('should stop one watch without affecting others', () => {
      watcher.start('/tmp/file-1.md', vi.fn());
      watcher.start('/tmp/file-2.md', vi.fn());

      watcher.stop('/tmp/file-1.md');

      expect(mockUnwatchFile).toHaveBeenCalledWith('/tmp/file-1.md');
      expect(watcher.isWatching('/tmp/file-1.md')).toBe(false);
      expect(watcher.isWatching('/tmp/file-2.md')).toBe(true);
    });

    it('should replace callback when starting a watch on an already-watched file', () => {
      watcher.start('/tmp/file-1.md', vi.fn());
      watcher.start('/tmp/file-1.md', vi.fn());

      expect(mockUnwatchFile).toHaveBeenCalledWith('/tmp/file-1.md');
      expect(mockWatchFile).toHaveBeenCalledTimes(2);
      expect(watcher.isWatching('/tmp/file-1.md')).toBe(true);
    });

    it('should invoke the correct callback when a watched file changes', async () => {
      const callback1 = vi.fn();
      const callback2 = vi.fn();
      const fileContent = '# Valid feedback content with enough characters to pass the minimum';

      mockReadFile.mockResolvedValue(fileContent);

      watcher.start('/tmp/file-1.md', callback1);
      watcher.start('/tmp/file-2.md', callback2);

      // Extract the listener passed to watchFile for file-2
      const file2Listener = mockWatchFile.mock.calls[1][2] as (curr: { mtimeMs: number }, prev: { mtimeMs: number }) => void;
      file2Listener({ mtimeMs: 1000 }, { mtimeMs: 0 });

      await vi.waitFor(() => {
        expect(callback2).toHaveBeenCalledWith(fileContent);
      });
      expect(callback1).not.toHaveBeenCalled();
    });

    it('should not invoke callback for content under 50 characters', async () => {
      const callback = vi.fn();
      mockReadFile.mockResolvedValue('short');

      watcher.start('/tmp/file-1.md', callback);

      const fileListener = mockWatchFile.mock.calls[0][2] as (curr: { mtimeMs: number }, prev: { mtimeMs: number }) => void;
      fileListener({ mtimeMs: 1000 }, { mtimeMs: 0 });

      await new Promise(resolve => setTimeout(resolve, 10));
      expect(callback).not.toHaveBeenCalled();
    });

    it('should not invoke callback when content has not changed', async () => {
      const callback = vi.fn();
      const content = '# Valid feedback content with enough characters to pass the minimum';
      mockReadFile.mockResolvedValue(content);

      watcher.start('/tmp/file-1.md', callback);

      const fileListener = mockWatchFile.mock.calls[0][2] as (curr: { mtimeMs: number }, prev: { mtimeMs: number }) => void;

      fileListener({ mtimeMs: 1000 }, { mtimeMs: 0 });
      await vi.waitFor(() => {
        expect(callback).toHaveBeenCalledTimes(1);
      });

      // Same mtime — should not re-read
      fileListener({ mtimeMs: 1000 }, { mtimeMs: 1000 });
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(callback).toHaveBeenCalledTimes(1);
    });

    it('should be a no-op when stopping a file that is not being watched', () => {
      watcher.stop('/tmp/not-watched.md');
      expect(mockUnwatchFile).not.toHaveBeenCalled();
    });

    it('should report correct count of active watches', () => {
      watcher.start('/tmp/file-1.md', vi.fn());
      watcher.start('/tmp/file-2.md', vi.fn());

      expect(watcher.getWatchCount()).toBe(2);

      watcher.stop('/tmp/file-1.md');
      expect(watcher.getWatchCount()).toBe(1);
    });

    it('should return all watched file paths', () => {
      watcher.start('/tmp/file-1.md', vi.fn());
      watcher.start('/tmp/file-2.md', vi.fn());

      const paths = watcher.getWatchedFilePaths();
      expect(paths).toContain('/tmp/file-1.md');
      expect(paths).toContain('/tmp/file-2.md');
      expect(paths).toHaveLength(2);
    });
  });
});
