import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createVisualEffectsActions } from '../visualEffectsActions';

describe('visualEffectsActions', () => {
  type TestState = {
    flashingNodeId: string | null;
  };
  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createVisualEffectsActions>;

  beforeEach(() => {
    state = {
      flashingNodeId: null,
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
    it('should set flashingNodeId immediately', () => {
      actions.flashNode('node-1');

      expect(state.flashingNodeId).toBe('node-1');
    });

    it('should clear flashingNodeId after timeout', () => {
      actions.flashNode('node-1');
      expect(state.flashingNodeId).toBe('node-1');

      vi.advanceTimersByTime(500);

      expect(state.flashingNodeId).toBe(null);
    });

    it('should allow flashing different nodes in sequence', () => {
      actions.flashNode('node-1');
      expect(state.flashingNodeId).toBe('node-1');

      vi.advanceTimersByTime(500);
      expect(state.flashingNodeId).toBe(null);

      actions.flashNode('node-2');
      expect(state.flashingNodeId).toBe('node-2');

      vi.advanceTimersByTime(500);
      expect(state.flashingNodeId).toBe(null);
    });

    it('should override previous flash if called before timeout', () => {
      actions.flashNode('node-1');
      expect(state.flashingNodeId).toBe('node-1');

      vi.advanceTimersByTime(300);

      actions.flashNode('node-2');
      expect(state.flashingNodeId).toBe('node-2');

      vi.advanceTimersByTime(500);
      expect(state.flashingNodeId).toBe(null);
    });
  });
});
