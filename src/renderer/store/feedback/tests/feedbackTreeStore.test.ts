import { describe, it, expect, beforeEach } from 'vitest';
import { feedbackTreeStore } from '../feedbackTreeStore';

describe('FeedbackTreeStoreManager', () => {
  beforeEach(() => {
    feedbackTreeStore.clearAll();
  });

  describe('initialize', () => {
    it('should create a store for a file path', () => {
      const nodes = {
        'root': { id: 'root', content: '', children: ['node-1'], metadata: {} },
        'node-1': { id: 'node-1', content: 'Test', children: [], metadata: {} },
      };

      feedbackTreeStore.initialize('/test/file.arbo', nodes, 'root');

      expect(feedbackTreeStore.hasFeedback('/test/file.arbo')).toBe(true);
    });

    it('should initialize store with correct nodes and root', () => {
      const nodes = {
        'root': { id: 'root', content: '', children: ['node-1'], metadata: {} },
        'node-1': { id: 'node-1', content: 'Test', children: [], metadata: {} },
      };

      feedbackTreeStore.initialize('/test/file.arbo', nodes, 'root');

      const store = feedbackTreeStore.getStoreForFile('/test/file.arbo');
      expect(store).not.toBeNull();

      const state = store!.getState();
      expect(state.rootNodeId).toBe('root');
      expect(state.nodes['root']).toBeDefined();
      expect(state.nodes['node-1']).toBeDefined();
    });
  });

  describe('getStoreForFile', () => {
    it('should return null for non-existent file', () => {
      expect(feedbackTreeStore.getStoreForFile('/nonexistent.arbo')).toBeNull();
    });

    it('should return store for initialized file', () => {
      const nodes = {
        'root': { id: 'root', content: '', children: [], metadata: {} },
      };
      feedbackTreeStore.initialize('/test/file.arbo', nodes, 'root');

      const store = feedbackTreeStore.getStoreForFile('/test/file.arbo');
      expect(store).not.toBeNull();
    });
  });

  describe('hasFeedback', () => {
    it('should return false for non-existent file', () => {
      expect(feedbackTreeStore.hasFeedback('/nonexistent.arbo')).toBe(false);
    });

    it('should return true for initialized file', () => {
      const nodes = {
        'root': { id: 'root', content: '', children: [], metadata: {} },
      };
      feedbackTreeStore.initialize('/test/file.arbo', nodes, 'root');

      expect(feedbackTreeStore.hasFeedback('/test/file.arbo')).toBe(true);
    });
  });

  describe('clearFile', () => {
    it('should remove store for specific file', () => {
      const nodes = {
        'root': { id: 'root', content: '', children: [], metadata: {} },
      };
      feedbackTreeStore.initialize('/file1.arbo', nodes, 'root');
      feedbackTreeStore.initialize('/file2.arbo', nodes, 'root');

      feedbackTreeStore.clearFile('/file1.arbo');

      expect(feedbackTreeStore.hasFeedback('/file1.arbo')).toBe(false);
      expect(feedbackTreeStore.hasFeedback('/file2.arbo')).toBe(true);
    });
  });

  describe('clearAll', () => {
    it('should remove all stores', () => {
      const nodes = {
        'root': { id: 'root', content: '', children: [], metadata: {} },
      };
      feedbackTreeStore.initialize('/file1.arbo', nodes, 'root');
      feedbackTreeStore.initialize('/file2.arbo', nodes, 'root');

      feedbackTreeStore.clearAll();

      expect(feedbackTreeStore.hasFeedback('/file1.arbo')).toBe(false);
      expect(feedbackTreeStore.hasFeedback('/file2.arbo')).toBe(false);
    });
  });
});
