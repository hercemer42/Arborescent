import { describe, it, expect, beforeEach } from 'vitest';
import { createNavigationActions } from './navigationActions';
import type { TreeNode } from '@shared/types';

describe('navigationActions', () => {
  let state: { nodes: Record<string, TreeNode>; rootNodeId: string; selectedNodeId: string | null; cursorPosition: number; rememberedVisualX: number | null };
  let setState: (partial: Partial<typeof state>) => void;
  let actions: ReturnType<typeof createNavigationActions>;

  beforeEach(() => {
    state = {
      nodes: {
        'root': {
          id: 'root',
          type: 'project',
          content: 'Root',
          children: ['child-1', 'child-2'],
          metadata: {},
        },
        'child-1': {
          id: 'child-1',
          type: 'task',
          content: 'Child 1',
          children: ['grandchild-1'],
          metadata: {},
        },
        'grandchild-1': {
          id: 'grandchild-1',
          type: 'task',
          content: 'Grandchild 1',
          children: [],
          metadata: {},
        },
        'child-2': {
          id: 'child-2',
          type: 'task',
          content: 'Child 2',
          children: [],
          metadata: {},
        },
      },
      rootNodeId: 'root',
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    actions = createNavigationActions(
      () => state,
      setState
    );
  });

  describe('moveUp', () => {
    it('should move selection up in flat list', () => {
      state.selectedNodeId = 'child-1';
      actions.moveUp();
      expect(state.selectedNodeId).toBe('root');
    });

    it('should not move up from first node', () => {
      state.selectedNodeId = 'root';
      actions.moveUp();
      expect(state.selectedNodeId).toBe('root');
    });

    it('should handle moving up from nested nodes', () => {
      state.selectedNodeId = 'grandchild-1';
      actions.moveUp();
      expect(state.selectedNodeId).toBe('child-1');
    });
  });

  describe('moveDown', () => {
    it('should move selection down in flat list', () => {
      state.selectedNodeId = 'root';
      actions.moveDown();
      expect(state.selectedNodeId).toBe('child-1');
    });

    it('should not move down from last node', () => {
      state.selectedNodeId = 'child-2';
      actions.moveDown();
      expect(state.selectedNodeId).toBe('child-2');
    });

    it('should handle moving down through nested nodes', () => {
      state.selectedNodeId = 'child-1';
      actions.moveDown();
      expect(state.selectedNodeId).toBe('grandchild-1');
    });

    it('should select first node when nothing selected', () => {
      state.selectedNodeId = null;
      actions.moveDown();
      expect(state.selectedNodeId).toBe('root');
    });
  });

  describe('moveToPrevious', () => {
    it('should move to previous node with cursor at end', () => {
      state.selectedNodeId = 'child-1';
      actions.moveToPrevious();
      expect(state.selectedNodeId).toBe('root');
      expect(state.cursorPosition).toBe(4);
      expect(state.rememberedVisualX).toBeNull();
    });

    it('should not move from first node', () => {
      state.selectedNodeId = 'root';
      actions.moveToPrevious();
      expect(state.selectedNodeId).toBe('root');
    });

    it('should handle moving from nested nodes', () => {
      state.selectedNodeId = 'grandchild-1';
      actions.moveToPrevious();
      expect(state.selectedNodeId).toBe('child-1');
      expect(state.cursorPosition).toBe(7);
    });

    it('should clear remembered visual X position', () => {
      state.selectedNodeId = 'child-1';
      state.rememberedVisualX = 10;
      actions.moveToPrevious();
      expect(state.rememberedVisualX).toBeNull();
    });
  });

  describe('moveToNext', () => {
    it('should move to next node with cursor at start', () => {
      state.selectedNodeId = 'root';
      actions.moveToNext();
      expect(state.selectedNodeId).toBe('child-1');
      expect(state.cursorPosition).toBe(0);
      expect(state.rememberedVisualX).toBeNull();
    });

    it('should not move from last node', () => {
      state.selectedNodeId = 'child-2';
      actions.moveToNext();
      expect(state.selectedNodeId).toBe('child-2');
    });

    it('should handle moving through nested nodes', () => {
      state.selectedNodeId = 'child-1';
      actions.moveToNext();
      expect(state.selectedNodeId).toBe('grandchild-1');
      expect(state.cursorPosition).toBe(0);
    });

    it('should clear remembered visual X position', () => {
      state.selectedNodeId = 'root';
      state.rememberedVisualX = 10;
      actions.moveToNext();
      expect(state.rememberedVisualX).toBeNull();
    });
  });
});
