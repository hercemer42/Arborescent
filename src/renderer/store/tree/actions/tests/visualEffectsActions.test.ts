import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createVisualEffectsActions } from '../visualEffectsActions';

describe('visualEffectsActions', () => {
  type TestState = {
    flashingNode: { nodeId: string; intensity: 'light' | 'medium' } | null;
    scrollToNodeId: string | null;
  };
  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createVisualEffectsActions>;

  beforeEach(() => {
    state = {
      flashingNode: null,
      scrollToNodeId: null,
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
});
