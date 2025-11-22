import { describe, it, expect, beforeEach } from 'vitest';
import { reviewTreeStore } from '../reviewTreeStore';

describe('ReviewTreeStoreManager', () => {
  beforeEach(() => {
    reviewTreeStore.clearAll();
  });

  describe('initialize', () => {
    it('should create a store for a file path', () => {
      const nodes = {
        'root': { id: 'root', content: '', children: ['node-1'], metadata: {} },
        'node-1': { id: 'node-1', content: 'Test', children: [], metadata: {} },
      };

      reviewTreeStore.initialize('/test/file.arbo', nodes, 'root');

      expect(reviewTreeStore.hasReview('/test/file.arbo')).toBe(true);
    });

    it('should initialize store with correct nodes and root', () => {
      const nodes = {
        'root': { id: 'root', content: '', children: ['node-1'], metadata: {} },
        'node-1': { id: 'node-1', content: 'Test', children: [], metadata: {} },
      };

      reviewTreeStore.initialize('/test/file.arbo', nodes, 'root');

      const store = reviewTreeStore.getStoreForFile('/test/file.arbo');
      expect(store).not.toBeNull();

      const state = store!.getState();
      expect(state.rootNodeId).toBe('root');
      expect(state.nodes['root']).toBeDefined();
      expect(state.nodes['node-1']).toBeDefined();
    });
  });

  describe('getStoreForFile', () => {
    it('should return null for non-existent file', () => {
      expect(reviewTreeStore.getStoreForFile('/nonexistent.arbo')).toBeNull();
    });

    it('should return store for initialized file', () => {
      const nodes = {
        'root': { id: 'root', content: '', children: [], metadata: {} },
      };
      reviewTreeStore.initialize('/test/file.arbo', nodes, 'root');

      const store = reviewTreeStore.getStoreForFile('/test/file.arbo');
      expect(store).not.toBeNull();
    });
  });

  describe('hasReview', () => {
    it('should return false for non-existent file', () => {
      expect(reviewTreeStore.hasReview('/nonexistent.arbo')).toBe(false);
    });

    it('should return true for initialized file', () => {
      const nodes = {
        'root': { id: 'root', content: '', children: [], metadata: {} },
      };
      reviewTreeStore.initialize('/test/file.arbo', nodes, 'root');

      expect(reviewTreeStore.hasReview('/test/file.arbo')).toBe(true);
    });
  });

  describe('clearFile', () => {
    it('should remove store for specific file', () => {
      const nodes = {
        'root': { id: 'root', content: '', children: [], metadata: {} },
      };
      reviewTreeStore.initialize('/file1.arbo', nodes, 'root');
      reviewTreeStore.initialize('/file2.arbo', nodes, 'root');

      reviewTreeStore.clearFile('/file1.arbo');

      expect(reviewTreeStore.hasReview('/file1.arbo')).toBe(false);
      expect(reviewTreeStore.hasReview('/file2.arbo')).toBe(true);
    });
  });

  describe('clearAll', () => {
    it('should remove all stores', () => {
      const nodes = {
        'root': { id: 'root', content: '', children: [], metadata: {} },
      };
      reviewTreeStore.initialize('/file1.arbo', nodes, 'root');
      reviewTreeStore.initialize('/file2.arbo', nodes, 'root');

      reviewTreeStore.clearAll();

      expect(reviewTreeStore.hasReview('/file1.arbo')).toBe(false);
      expect(reviewTreeStore.hasReview('/file2.arbo')).toBe(false);
    });
  });
});
