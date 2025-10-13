import { describe, it, expect, beforeEach, vi } from 'vitest';
import { storeManager } from './storeManager';

describe('storeManager', () => {
  beforeEach(() => {
    storeManager.clearAll();
  });

  describe('getStoreForFile', () => {
    it('should create a new store for a file', () => {
      const store = storeManager.getStoreForFile('/path/file.arbo');

      expect(store).toBeDefined();
      expect(store.getState()).toHaveProperty('nodes');
      expect(store.getState()).toHaveProperty('actions');
    });

    it('should return the same store for the same file', () => {
      const store1 = storeManager.getStoreForFile('/path/file.arbo');
      const store2 = storeManager.getStoreForFile('/path/file.arbo');

      expect(store1).toBe(store2);
    });

    it('should create different stores for different files', () => {
      const store1 = storeManager.getStoreForFile('/path/file1.arbo');
      const store2 = storeManager.getStoreForFile('/path/file2.arbo');

      expect(store1).not.toBe(store2);
    });
  });

  describe('closeFile', () => {
    it('should remove store from cache', async () => {
      storeManager.getStoreForFile('/path/file.arbo');
      expect(storeManager.hasStore('/path/file.arbo')).toBe(true);

      await storeManager.closeFile('/path/file.arbo');
      expect(storeManager.hasStore('/path/file.arbo')).toBe(false);
    });

    it('should save file before closing if it has a path', async () => {
      const store = storeManager.getStoreForFile('/path/file.arbo');
      const saveToPathSpy = vi.spyOn(store.getState().actions, 'saveToPath');

      // Set up the store with a file path
      store.setState({ currentFilePath: '/path/file.arbo' });

      await storeManager.closeFile('/path/file.arbo');

      expect(saveToPathSpy).toHaveBeenCalledWith('/path/file.arbo', undefined);
    });

    it('should not throw if closing non-existent file', async () => {
      await expect(storeManager.closeFile('/path/nonexistent.arbo')).resolves.not.toThrow();
    });
  });

  describe('hasStore', () => {
    it('should return true for existing store', () => {
      storeManager.getStoreForFile('/path/file.arbo');
      expect(storeManager.hasStore('/path/file.arbo')).toBe(true);
    });

    it('should return false for non-existent store', () => {
      expect(storeManager.hasStore('/path/nonexistent.arbo')).toBe(false);
    });
  });

  describe('clearAll', () => {
    it('should clear all stores', () => {
      storeManager.getStoreForFile('/path/file1.arbo');
      storeManager.getStoreForFile('/path/file2.arbo');

      expect(storeManager.hasStore('/path/file1.arbo')).toBe(true);
      expect(storeManager.hasStore('/path/file2.arbo')).toBe(true);

      storeManager.clearAll();

      expect(storeManager.hasStore('/path/file1.arbo')).toBe(false);
      expect(storeManager.hasStore('/path/file2.arbo')).toBe(false);
    });
  });
});
