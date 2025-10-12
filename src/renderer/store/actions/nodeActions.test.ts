import { describe, it, expect, beforeEach } from 'vitest';
import { createNodeActions } from './nodeActions';
import type { TreeNode } from '@shared/types';

describe('nodeActions', () => {
  type TestState = { nodes: Record<string, TreeNode>; selectedNodeId: string | null; cursorPosition: number; rememberedCursorColumn: number | null };
  let state: TestState;
  let setState: (partial: Partial<TestState> | ((state: TestState) => Partial<TestState>)) => void;
  let actions: ReturnType<typeof createNodeActions>;

  beforeEach(() => {
    state = {
      nodes: {
        'node-1': {
          id: 'node-1',
          type: 'task',
          content: 'Test Task',
          children: [],
          metadata: { status: '☐' },
        },
        'node-2': {
          id: 'node-2',
          type: 'project',
          content: 'Test Project',
          children: ['node-1'],
          metadata: {},
        },
      },
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedCursorColumn: null,
    };

    setState = (partial) => {
      if (typeof partial === 'function') {
        state = { ...state, ...partial(state) };
      } else {
        state = { ...state, ...partial };
      }
    };

    actions = createNodeActions(
      () => state,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState as any
    );
  });

  describe('selectNode', () => {
    it('should select a node', () => {
      actions.selectNode('node-1');
      expect(state.selectedNodeId).toBe('node-1');
    });
  });

  describe('updateContent', () => {
    it('should update node content', () => {
      actions.updateContent('node-1', 'Updated Task');
      expect(state.nodes['node-1'].content).toBe('Updated Task');
    });

    it('should update content without affecting other nodes', () => {
      actions.updateContent('node-1', 'Updated Task');
      expect(state.nodes['node-1'].content).toBe('Updated Task');
      expect(state.nodes['node-2'].content).toBe('Test Project');
    });
  });

  describe('updateStatus', () => {
    it('should update task status', () => {
      actions.updateStatus('node-1', '✓');
      expect(state.nodes['node-1'].metadata.status).toBe('✓');
    });
  });

  describe('deleteNode', () => {
    it('should delete a node', () => {
      actions.deleteNode('node-1');
      expect(state.nodes['node-1']).toBeUndefined();
      expect(state.nodes['node-2']).toBeDefined();
    });
  });
});
