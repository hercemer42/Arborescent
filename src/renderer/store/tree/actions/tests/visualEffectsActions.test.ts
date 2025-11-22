import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createVisualEffectsActions } from '../visualEffectsActions';

describe('visualEffectsActions', () => {
  type TestState = {
    flashingNode: { nodeId: string; intensity: 'light' | 'medium' } | null;
    scrollToNodeId: string | null;
    deletingNodeIds: Set<string>;
    deleteAnimationCallback: (() => void) | null;
  };
  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createVisualEffectsActions>;

  beforeEach(() => {
    state = {
      flashingNode: null,
      scrollToNodeId: null,
      deletingNodeIds: new Set(),
      deleteAnimationCallback: null,
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    actions = createVisualEffectsActions(
      () => state,
      setState
    );

    vi.useFakeTimers();
  });

  describe('flashNode', () => {
    it('should set flashingNode with light intensity by default', () => {
      actions.flashNode('node-1');

      expect(state.flashingNode).toEqual({ nodeId: 'node-1', intensity: 'light' });
    });

    it('should set flashingNode with medium intensity when specified', () => {
      actions.flashNode('node-1', 'medium');

      expect(state.flashingNode).toEqual({ nodeId: 'node-1', intensity: 'medium' });
    });

    it('should clear flashingNode after timeout', () => {
      actions.flashNode('node-1');
      expect(state.flashingNode).toEqual({ nodeId: 'node-1', intensity: 'light' });

      vi.advanceTimersByTime(500);

      expect(state.flashingNode).toBe(null);
    });

    it('should allow flashing different nodes in sequence', () => {
      actions.flashNode('node-1');
      expect(state.flashingNode).toEqual({ nodeId: 'node-1', intensity: 'light' });

      vi.advanceTimersByTime(500);
      expect(state.flashingNode).toBe(null);

      actions.flashNode('node-2', 'medium');
      expect(state.flashingNode).toEqual({ nodeId: 'node-2', intensity: 'medium' });

      vi.advanceTimersByTime(500);
      expect(state.flashingNode).toBe(null);
    });

    it('should override previous flash if called before timeout', () => {
      actions.flashNode('node-1');
      expect(state.flashingNode).toEqual({ nodeId: 'node-1', intensity: 'light' });

      vi.advanceTimersByTime(300);

      actions.flashNode('node-2', 'medium');
      expect(state.flashingNode).toEqual({ nodeId: 'node-2', intensity: 'medium' });

      vi.advanceTimersByTime(500);
      expect(state.flashingNode).toBe(null);
    });
  });

  describe('scrollToNode', () => {
    it('should set scrollToNodeId immediately', () => {
      actions.scrollToNode('node-1');

      expect(state.scrollToNodeId).toBe('node-1');
    });

    it('should clear scrollToNodeId after timeout', () => {
      actions.scrollToNode('node-1');
      expect(state.scrollToNodeId).toBe('node-1');

      vi.advanceTimersByTime(100);

      expect(state.scrollToNodeId).toBe(null);
    });

    it('should allow scrolling to different nodes in sequence', () => {
      actions.scrollToNode('node-1');
      expect(state.scrollToNodeId).toBe('node-1');

      vi.advanceTimersByTime(100);
      expect(state.scrollToNodeId).toBe(null);

      actions.scrollToNode('node-2');
      expect(state.scrollToNodeId).toBe('node-2');

      vi.advanceTimersByTime(100);
      expect(state.scrollToNodeId).toBe(null);
    });
  });

  describe('startDeleteAnimation', () => {
    it('should set deletingNodeIds with single node', () => {
      actions.startDeleteAnimation('node-1');

      expect(state.deletingNodeIds.has('node-1')).toBe(true);
      expect(state.deletingNodeIds.size).toBe(1);
    });

    it('should set deletingNodeIds with multiple nodes', () => {
      actions.startDeleteAnimation(['node-1', 'node-2', 'node-3']);

      expect(state.deletingNodeIds.has('node-1')).toBe(true);
      expect(state.deletingNodeIds.has('node-2')).toBe(true);
      expect(state.deletingNodeIds.has('node-3')).toBe(true);
      expect(state.deletingNodeIds.size).toBe(3);
    });

    it('should store callback when provided', () => {
      const callback = vi.fn();
      actions.startDeleteAnimation('node-1', callback);

      expect(state.deletingNodeIds.has('node-1')).toBe(true);
      expect(state.deleteAnimationCallback).toBe(callback);
    });

    it('should set callback to null when not provided', () => {
      actions.startDeleteAnimation('node-1');

      expect(state.deleteAnimationCallback).toBe(null);
    });
  });

  describe('clearDeleteAnimation', () => {
    it('should remove node from deletingNodeIds', () => {
      state.deletingNodeIds = new Set(['node-1']);

      actions.clearDeleteAnimation('node-1');

      expect(state.deletingNodeIds.has('node-1')).toBe(false);
      expect(state.deletingNodeIds.size).toBe(0);
    });

    it('should execute callback when last node clears', () => {
      const callback = vi.fn();
      state.deletingNodeIds = new Set(['node-1']);
      state.deleteAnimationCallback = callback;

      actions.clearDeleteAnimation('node-1');

      expect(callback).toHaveBeenCalled();
    });

    it('should not execute callback when nodes remain', () => {
      const callback = vi.fn();
      state.deletingNodeIds = new Set(['node-1', 'node-2']);
      state.deleteAnimationCallback = callback;

      actions.clearDeleteAnimation('node-1');

      expect(callback).not.toHaveBeenCalled();
      expect(state.deletingNodeIds.has('node-2')).toBe(true);
      expect(state.deletingNodeIds.size).toBe(1);
    });

    it('should clear callback after executing', () => {
      const callback = vi.fn();
      state.deletingNodeIds = new Set(['node-1']);
      state.deleteAnimationCallback = callback;

      actions.clearDeleteAnimation('node-1');

      expect(state.deleteAnimationCallback).toBe(null);
    });

    it('should not throw when no callback is present', () => {
      state.deletingNodeIds = new Set(['node-1']);
      state.deleteAnimationCallback = null;

      expect(() => actions.clearDeleteAnimation('node-1')).not.toThrow();
      expect(state.deletingNodeIds.size).toBe(0);
    });

    it('should clear state before executing callback', () => {
      let deletingNodeIdsAtCallbackTime: Set<string> | null = null;
      let deleteAnimationCallbackAtCallbackTime: (() => void) | null | string = 'unset';
      const callback = () => {
        deletingNodeIdsAtCallbackTime = new Set(state.deletingNodeIds);
        deleteAnimationCallbackAtCallbackTime = state.deleteAnimationCallback;
      };
      state.deletingNodeIds = new Set(['node-1']);
      state.deleteAnimationCallback = callback;

      actions.clearDeleteAnimation('node-1');

      expect(deletingNodeIdsAtCallbackTime!.size).toBe(0);
      expect(deleteAnimationCallbackAtCallbackTime).toBe(null);
    });

    it('should handle multiple nodes completing in sequence', () => {
      const callback = vi.fn();
      state.deletingNodeIds = new Set(['node-1', 'node-2', 'node-3']);
      state.deleteAnimationCallback = callback;

      actions.clearDeleteAnimation('node-1');
      expect(callback).not.toHaveBeenCalled();
      expect(state.deletingNodeIds.size).toBe(2);

      actions.clearDeleteAnimation('node-2');
      expect(callback).not.toHaveBeenCalled();
      expect(state.deletingNodeIds.size).toBe(1);

      actions.clearDeleteAnimation('node-3');
      expect(callback).toHaveBeenCalledTimes(1);
      expect(state.deletingNodeIds.size).toBe(0);
    });
  });
});
