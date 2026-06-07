import { describe, it, expect, beforeEach } from 'vitest';
import { feedbackTreeStore } from '../feedbackTreeStore';
import { createTreeStore } from '../../tree/treeStore';

const FILE = '/test/file.arbo';

function nodesFor(childId: string) {
  return {
    root: { id: 'root', content: '', children: [childId], metadata: {} },
    [childId]: { id: childId, content: 'Test', children: [], metadata: {} },
  };
}

describe('FeedbackTreeStoreManager', () => {
  beforeEach(() => {
    feedbackTreeStore.setStoreFactory(() => createTreeStore('feedback'));
    feedbackTreeStore.clearAll();
  });

  describe('initialize', () => {
    it('should create a store for a reviewed node', () => {
      feedbackTreeStore.initialize('node-1', FILE, nodesFor('child-1'), 'root');

      expect(feedbackTreeStore.hasFeedbackForNode('node-1')).toBe(true);
    });

    it('should initialize store with correct nodes and root', () => {
      feedbackTreeStore.initialize('node-1', FILE, nodesFor('child-1'), 'root');

      const store = feedbackTreeStore.getStoreForNode('node-1');
      expect(store).not.toBeNull();

      const state = store!.getState();
      expect(state.rootNodeId).toBe('root');
      expect(state.nodes['root']).toBeDefined();
      expect(state.nodes['child-1']).toBeDefined();
    });
  });

  describe('getStoreForNode', () => {
    it('should return null for an unknown reviewed node', () => {
      expect(feedbackTreeStore.getStoreForNode('nope')).toBeNull();
    });

    it('should return store for an initialized reviewed node', () => {
      feedbackTreeStore.initialize('node-1', FILE, nodesFor('child-1'), 'root');

      expect(feedbackTreeStore.getStoreForNode('node-1')).not.toBeNull();
    });
  });

  describe('hasFeedbackForNode', () => {
    it('should return false for an unknown reviewed node', () => {
      expect(feedbackTreeStore.hasFeedbackForNode('nope')).toBe(false);
    });

    it('should return true for an initialized reviewed node', () => {
      feedbackTreeStore.initialize('node-1', FILE, nodesFor('child-1'), 'root');

      expect(feedbackTreeStore.hasFeedbackForNode('node-1')).toBe(true);
    });
  });

  describe('clearForFile', () => {
    it('should remove every reviewed-node store belonging to the file', () => {
      feedbackTreeStore.initialize('node-a', '/file1.arbo', nodesFor('a'), 'root');
      feedbackTreeStore.initialize('node-b', '/file1.arbo', nodesFor('b'), 'root');
      feedbackTreeStore.initialize('node-c', '/file2.arbo', nodesFor('c'), 'root');

      feedbackTreeStore.clearForFile('/file1.arbo');

      expect(feedbackTreeStore.hasFeedbackForNode('node-a')).toBe(false);
      expect(feedbackTreeStore.hasFeedbackForNode('node-b')).toBe(false);
      expect(feedbackTreeStore.hasFeedbackForNode('node-c')).toBe(true);
    });
  });

  describe('clearAll', () => {
    it('should remove all stores', () => {
      feedbackTreeStore.initialize('node-a', '/file1.arbo', nodesFor('a'), 'root');
      feedbackTreeStore.initialize('node-b', '/file2.arbo', nodesFor('b'), 'root');

      feedbackTreeStore.clearAll();

      expect(feedbackTreeStore.hasFeedbackForNode('node-a')).toBe(false);
      expect(feedbackTreeStore.hasFeedbackForNode('node-b')).toBe(false);
    });
  });

  describe('PR5 — per-reviewed-node working store', () => {
    it('keys the editable proposition working store by reviewed node id so multiple propositions coexist for one file', () => {
      feedbackTreeStore.initialize('node-a', FILE, nodesFor('a'), 'root');
      feedbackTreeStore.initialize('node-b', FILE, nodesFor('b'), 'root');

      expect(feedbackTreeStore.hasFeedbackForNode('node-a')).toBe(true);
      expect(feedbackTreeStore.hasFeedbackForNode('node-b')).toBe(true);
      expect(feedbackTreeStore.getStoreForNode('node-a')).not.toBe(feedbackTreeStore.getStoreForNode('node-b'));
    });

    it('resolves and edits each reviewed node\'s working store independently of other in-review nodes in the same file', () => {
      feedbackTreeStore.initialize('node-a', FILE, nodesFor('a'), 'root');
      feedbackTreeStore.initialize('node-b', FILE, nodesFor('b'), 'root');

      const storeA = feedbackTreeStore.getStoreForNode('node-a')!;
      const storeB = feedbackTreeStore.getStoreForNode('node-b')!;

      expect(storeA.getState().nodes['a']).toBeDefined();
      expect(storeA.getState().nodes['b']).toBeUndefined();
      expect(storeB.getState().nodes['b']).toBeDefined();
      expect(storeB.getState().nodes['a']).toBeUndefined();
    });

    it('clears only the resolved reviewed node\'s working store, leaving sibling reviews in the same file intact', () => {
      feedbackTreeStore.initialize('node-a', FILE, nodesFor('a'), 'root');
      feedbackTreeStore.initialize('node-b', FILE, nodesFor('b'), 'root');

      feedbackTreeStore.clearForNode('node-a');

      expect(feedbackTreeStore.hasFeedbackForNode('node-a')).toBe(false);
      expect(feedbackTreeStore.hasFeedbackForNode('node-b')).toBe(true);
    });
  });
});
