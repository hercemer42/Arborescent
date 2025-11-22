import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createVisualEffectsActions } from '../visualEffectsActions';

describe('visualEffectsActions', () => {
  type TestState = {
    flashingNode: { nodeId: string; intensity: 'light' | 'medium' } | null;
    scrollToNodeId: string | null;
    deletingNodeId: string | null;
    deleteAnimationCallback: (() => void) | null;
  };
  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createVisualEffectsActions>;

  beforeEach(() => {
    state = {
      flashingNode: null,
      scrollToNodeId: null,
      deletingNodeId: null,
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
    it('should set deletingNodeId', () => {
      actions.startDeleteAnimation('node-1');

      expect(state.deletingNodeId).toBe('node-1');
    });

    it('should store callback when provided', () => {
      const callback = vi.fn();
      actions.startDeleteAnimation('node-1', callback);

      expect(state.deletingNodeId).toBe('node-1');
      expect(state.deleteAnimationCallback).toBe(callback);
    });

    it('should set callback to null when not provided', () => {
      actions.startDeleteAnimation('node-1');

      expect(state.deleteAnimationCallback).toBe(null);
    });
  });

  describe('clearDeleteAnimation', () => {
    it('should clear deletingNodeId', () => {
      state.deletingNodeId = 'node-1';

      actions.clearDeleteAnimation();

      expect(state.deletingNodeId).toBe(null);
    });

    it('should execute callback when present', () => {
      const callback = vi.fn();
      state.deletingNodeId = 'node-1';
      state.deleteAnimationCallback = callback;

      actions.clearDeleteAnimation();

      expect(callback).toHaveBeenCalled();
    });

    it('should clear callback after executing', () => {
      const callback = vi.fn();
      state.deletingNodeId = 'node-1';
      state.deleteAnimationCallback = callback;

      actions.clearDeleteAnimation();

      expect(state.deleteAnimationCallback).toBe(null);
    });

    it('should not throw when no callback is present', () => {
      state.deletingNodeId = 'node-1';
      state.deleteAnimationCallback = null;

      expect(() => actions.clearDeleteAnimation()).not.toThrow();
      expect(state.deletingNodeId).toBe(null);
    });

    it('should clear state before executing callback', () => {
      let deletingNodeIdAtCallbackTime: string | null = 'unset';
      let deleteAnimationCallbackAtCallbackTime: (() => void) | null | string = 'unset';
      const callback = () => {
        deletingNodeIdAtCallbackTime = state.deletingNodeId;
        deleteAnimationCallbackAtCallbackTime = state.deleteAnimationCallback;
      };
      state.deletingNodeId = 'node-1';
      state.deleteAnimationCallback = callback;

      actions.clearDeleteAnimation();

      expect(deletingNodeIdAtCallbackTime).toBe(null);
      expect(deleteAnimationCallbackAtCallbackTime).toBe(null);
    });
  });
});
