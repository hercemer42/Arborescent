import { describe, it, expect, beforeEach } from 'vitest';
import { createNodeActions } from './nodeActions';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../services/registryService';

describe('nodeActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: AncestorRegistry;
    selectedNodeId: string | null;
    cursorPosition: number;
    rememberedVisualX: number | null;
  };
  let state: TestState;
  let setState: (partial: Partial<TestState> | ((state: TestState) => Partial<TestState>)) => void;
  let actions: ReturnType<typeof createNodeActions>;

  beforeEach(() => {
    state = {
      nodes: {
        'root': {
          id: 'root',
          type: 'project',
          content: 'Root',
          children: ['node-1', 'node-2'],
          metadata: {},
        },
        'node-1': {
          id: 'node-1',
          type: 'task',
          content: 'Task 1',
          children: ['node-3'],
          metadata: { status: '☐' },
        },
        'node-2': {
          id: 'node-2',
          type: 'task',
          content: 'Task 2',
          children: [],
          metadata: { status: '☐' },
        },
        'node-3': {
          id: 'node-3',
          type: 'task',
          content: 'Task 3',
          children: [],
          metadata: { status: '☐' },
        },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'node-1': ['root'],
        'node-2': ['root'],
        'node-3': ['root', 'node-1'],
      },
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
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
      expect(state.nodes['node-2'].content).toBe('Task 2');
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

  describe('createSiblingNode', () => {
    it('should create a new sibling node after current node', () => {
      actions.createSiblingNode('node-1');

      expect(state.nodes['root'].children).toHaveLength(3);

      const children = state.nodes['root'].children;
      expect(children[0]).toBe('node-1');
      expect(children[2]).toBe('node-2');

      const newNodeId = children[1];
      const newNode = state.nodes[newNodeId];

      expect(newNode).toBeDefined();
      expect(newNode.type).toBe('task');
      expect(newNode.content).toBe('');
      expect(newNode.children).toEqual([]);
      expect(newNode.metadata.status).toBe('☐');
    });

    it('should select the new node with cursor at position 0', () => {
      actions.createSiblingNode('node-1');

      const newNodeId = state.nodes['root'].children[1];
      expect(state.selectedNodeId).toBe(newNodeId);
      expect(state.cursorPosition).toBe(0);
      expect(state.rememberedVisualX).toBeNull();
    });

    it('should update ancestor registry', () => {
      actions.createSiblingNode('node-1');

      const newNodeId = state.nodes['root'].children[1];
      expect(state.ancestorRegistry[newNodeId]).toEqual(['root']);
    });

    it('should always create task type nodes', () => {
      state.nodes['node-1'].type = 'project';

      actions.createSiblingNode('node-1');

      const newNodeId = state.nodes['root'].children[1];
      expect(state.nodes[newNodeId].type).toBe('task');
      expect(state.nodes[newNodeId].metadata.status).toBe('☐');
    });
  });

});
