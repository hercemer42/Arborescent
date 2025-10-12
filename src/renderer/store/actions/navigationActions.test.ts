import { describe, it, expect, beforeEach } from 'vitest';
import { createNavigationActions } from './navigationActions';
import type { TreeNode } from '@shared/types';

describe('navigationActions', () => {
  let state: { nodes: Record<string, TreeNode>; rootNodeId: string; selectedNodeId: string | null };
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
});
