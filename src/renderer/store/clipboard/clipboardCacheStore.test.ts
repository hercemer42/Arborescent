import { describe, it, expect, beforeEach } from 'vitest';
import { useClipboardCacheStore } from './clipboardCacheStore';

describe('clipboardCacheStore', () => {
  beforeEach(() => {
    useClipboardCacheStore.getState().clearCache();
  });

  describe('setCache', () => {
    it('should store root node IDs', () => {
      useClipboardCacheStore.getState().setCache(['node-1', 'node-2'], false);

      const cache = useClipboardCacheStore.getState().getCache();
      expect(cache).not.toBeNull();
      expect(cache?.rootNodeIds).toEqual(['node-1', 'node-2']);
    });

    it('should include timestamp', () => {
      const before = Date.now();

      useClipboardCacheStore.getState().setCache(['node-1'], false);

      const after = Date.now();
      const cache = useClipboardCacheStore.getState().getCache();

      expect(cache?.timestamp).toBeGreaterThanOrEqual(before);
      expect(cache?.timestamp).toBeLessThanOrEqual(after);
    });

    it('should replace existing cache', () => {
      useClipboardCacheStore.getState().setCache(['first'], false);
      useClipboardCacheStore.getState().setCache(['second'], false);

      const cache = useClipboardCacheStore.getState().getCache();
      expect(cache?.rootNodeIds).toEqual(['second']);
    });

    it('should store isCut flag for copy operation', () => {
      useClipboardCacheStore.getState().setCache(['node-1'], false);

      const cache = useClipboardCacheStore.getState().getCache();
      expect(cache?.isCut).toBe(false);
    });

    it('should store isCut flag for cut operation', () => {
      useClipboardCacheStore.getState().setCache(['node-1'], true);

      const cache = useClipboardCacheStore.getState().getCache();
      expect(cache?.isCut).toBe(true);
    });
  });

  describe('getCache', () => {
    it('should return null when cache is empty', () => {
      const cache = useClipboardCacheStore.getState().getCache();
      expect(cache).toBeNull();
    });

    it('should return cached content', () => {
      useClipboardCacheStore.getState().setCache(['node-1'], false);

      const cache = useClipboardCacheStore.getState().getCache();
      expect(cache).not.toBeNull();
      expect(cache?.rootNodeIds).toEqual(['node-1']);
    });
  });

  describe('clearCache', () => {
    it('should clear cached content', () => {
      useClipboardCacheStore.getState().setCache(['node-1'], false);
      useClipboardCacheStore.getState().clearCache();

      const cache = useClipboardCacheStore.getState().getCache();
      expect(cache).toBeNull();
    });
  });

  describe('hasCache', () => {
    it('should return false when cache is empty', () => {
      expect(useClipboardCacheStore.getState().hasCache()).toBe(false);
    });

    it('should return true when cache has content', () => {
      useClipboardCacheStore.getState().setCache(['node-1'], false);

      expect(useClipboardCacheStore.getState().hasCache()).toBe(true);
    });

    it('should return false after cache is cleared', () => {
      useClipboardCacheStore.getState().setCache(['node-1'], false);
      useClipboardCacheStore.getState().clearCache();

      expect(useClipboardCacheStore.getState().hasCache()).toBe(false);
    });
  });
});
