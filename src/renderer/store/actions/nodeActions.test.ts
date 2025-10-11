import { describe, it, expect, beforeEach } from 'vitest';
import { createNodeActions } from './nodeActions';
import type { Node } from '@shared/types';

describe('nodeActions', () => {
  type TestState = { nodes: Record<string, Node>; selectedNodeId: string | null; editingNodeId: string | null };
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
      editingNodeId: null,
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

  describe('startEdit', () => {
    it('should start editing a node', () => {
      actions.startEdit('node-1');
      expect(state.editingNodeId).toBe('node-1');
    });
  });

  describe('finishEdit', () => {
    it('should finish editing', () => {
      state.editingNodeId = 'node-1';
      actions.finishEdit();
      expect(state.editingNodeId).toBeNull();
    });
  });

  describe('selectAndEdit', () => {
    it('should select a node on first click', () => {
      actions.selectAndEdit('node-1');
      expect(state.selectedNodeId).toBe('node-1');
      expect(state.editingNodeId).toBeNull();
    });

    it('should start editing on second click of same node', () => {
      state.selectedNodeId = 'node-1';
      actions.selectAndEdit('node-1');
      expect(state.editingNodeId).toBe('node-1');
    });
  });

  describe('updateContent', () => {
    it('should update node content', () => {
      actions.updateContent('node-1', 'Updated Task');
      expect(state.nodes['node-1'].content).toBe('Updated Task');
    });
  });

  describe('updateStatus', () => {
    it('should update task status', () => {
      actions.updateStatus('node-1', '✓');
      expect(state.nodes['node-1'].metadata.status).toBe('✓');
    });
  });

  describe('saveNodeContent', () => {
    it('should save content and finish editing', () => {
      state.editingNodeId = 'node-1';
      actions.saveNodeContent('node-1', 'Saved Content');
      expect(state.nodes['node-1'].content).toBe('Saved Content');
      expect(state.editingNodeId).toBeNull();
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
