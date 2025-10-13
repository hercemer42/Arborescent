import { describe, it, expect, beforeEach } from 'vitest';
import { createTreeStructureActions } from './treeStructureActions';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../services/registryService';

describe('treeStructureActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: AncestorRegistry;
  };
  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createTreeStructureActions>;

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
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    actions = createTreeStructureActions(
      () => state,
      setState
    );
  });

  describe('indentNode', () => {
    it('should make node a child of previous sibling', () => {
      actions.indentNode('node-2');

      expect(state.nodes['root'].children).toEqual(['node-1']);
      expect(state.nodes['node-1'].children).toEqual(['node-3', 'node-2']);
    });

    it('should update ancestor registry', () => {
      actions.indentNode('node-2');

      expect(state.ancestorRegistry['node-2']).toEqual(['root', 'node-1']);
    });

    it('should not indent first child', () => {
      const originalRootChildren = [...state.nodes['root'].children];

      actions.indentNode('node-1');

      expect(state.nodes['root'].children).toEqual(originalRootChildren);
    });

    it('should handle deeply nested indentation', () => {
      state.nodes['node-1'].children = ['node-3', 'node-4'];
      state.nodes['node-4'] = {
        id: 'node-4',
        type: 'task',
        content: 'Task 4',
        children: [],
        metadata: { status: '☐' },
      };
      state.ancestorRegistry['node-4'] = ['root', 'node-1'];

      actions.indentNode('node-4');

      expect(state.nodes['node-1'].children).toEqual(['node-3']);
      expect(state.nodes['node-3'].children).toEqual(['node-4']);
      expect(state.ancestorRegistry['node-4']).toEqual(['root', 'node-1', 'node-3']);
    });
  });

  describe('outdentNode', () => {
    it('should make node a sibling of parent', () => {
      actions.outdentNode('node-3');

      expect(state.nodes['node-1'].children).toEqual([]);
      expect(state.nodes['root'].children).toEqual(['node-1', 'node-3', 'node-2']);
    });

    it('should update ancestor registry', () => {
      actions.outdentNode('node-3');

      expect(state.ancestorRegistry['node-3']).toEqual(['root']);
    });

    it('should not outdent nodes that are already children of root', () => {
      const originalRootChildren = [...state.nodes['root'].children];

      actions.outdentNode('node-1');

      expect(state.nodes['root'].children).toEqual(originalRootChildren);
    });

    it('should allow outdenting to root level', () => {
      actions.outdentNode('node-3');

      expect(state.nodes['node-1'].children).toEqual([]);
      expect(state.nodes['root'].children).toEqual(['node-1', 'node-3', 'node-2']);
      expect(state.ancestorRegistry['node-3']).toEqual(['root']);
    });

    it('should position outdented node after its parent', () => {
      state.nodes['node-1'].children = ['node-3', 'node-5'];
      state.nodes['node-5'] = {
        id: 'node-5',
        type: 'task',
        content: 'Task 5',
        children: [],
        metadata: { status: '☐' },
      };
      state.ancestorRegistry['node-5'] = ['root', 'node-1'];

      actions.outdentNode('node-5');

      expect(state.nodes['root'].children).toEqual(['node-1', 'node-5', 'node-2']);
      expect(state.ancestorRegistry['node-5']).toEqual(['root']);
    });
  });

  describe('moveNodeUp', () => {
    it('should swap node with previous sibling', () => {
      actions.moveNodeUp('node-2');

      expect(state.nodes['root'].children).toEqual(['node-2', 'node-1']);
    });

    it('should not move first child of root up', () => {
      const originalChildren = [...state.nodes['root'].children];

      actions.moveNodeUp('node-1');

      expect(state.nodes['root'].children).toEqual(originalChildren);
    });

    it('should work with nested nodes', () => {
      state.nodes['node-1'].children = ['node-3', 'node-4'];
      state.nodes['node-4'] = {
        id: 'node-4',
        type: 'task',
        content: 'Task 4',
        children: [],
        metadata: { status: '☐' },
      };
      state.ancestorRegistry['node-4'] = ['root', 'node-1'];

      actions.moveNodeUp('node-4');

      expect(state.nodes['node-1'].children).toEqual(['node-4', 'node-3']);
    });

    it('should move first child to become last child of previous sibling', () => {
      state.nodes['node-1'].children = ['node-3'];
      state.nodes['node-2'].children = ['node-4'];
      state.nodes['node-4'] = {
        id: 'node-4',
        type: 'task',
        content: 'Task 4',
        children: [],
        metadata: { status: '☐' },
      };
      state.ancestorRegistry['node-4'] = ['root', 'node-2'];

      actions.moveNodeUp('node-4');

      expect(state.nodes['node-1'].children).toEqual(['node-3', 'node-4']);
      expect(state.nodes['node-2'].children).toEqual([]);
      expect(state.ancestorRegistry['node-4']).toEqual(['root', 'node-1']);
    });
  });

  describe('moveNodeDown', () => {
    it('should swap node with next sibling', () => {
      actions.moveNodeDown('node-1');

      expect(state.nodes['root'].children).toEqual(['node-2', 'node-1']);
    });

    it('should not move last child of root down', () => {
      const originalChildren = [...state.nodes['root'].children];

      actions.moveNodeDown('node-2');

      expect(state.nodes['root'].children).toEqual(originalChildren);
    });

    it('should work with nested nodes', () => {
      state.nodes['node-1'].children = ['node-3', 'node-4'];
      state.nodes['node-4'] = {
        id: 'node-4',
        type: 'task',
        content: 'Task 4',
        children: [],
        metadata: { status: '☐' },
      };
      state.ancestorRegistry['node-4'] = ['root', 'node-1'];

      actions.moveNodeDown('node-3');

      expect(state.nodes['node-1'].children).toEqual(['node-4', 'node-3']);
    });

    it('should move last child to become first child of next sibling', () => {
      state.nodes['node-1'].children = ['node-4'];
      state.nodes['node-2'].children = ['node-3'];
      state.nodes['node-4'] = {
        id: 'node-4',
        type: 'task',
        content: 'Task 4',
        children: [],
        metadata: { status: '☐' },
      };
      state.ancestorRegistry['node-4'] = ['root', 'node-1'];

      actions.moveNodeDown('node-4');

      expect(state.nodes['node-1'].children).toEqual([]);
      expect(state.nodes['node-2'].children).toEqual(['node-4', 'node-3']);
      expect(state.ancestorRegistry['node-4']).toEqual(['root', 'node-2']);
    });
  });

  describe('deleteNode', () => {
    it('should delete node without children and return true', () => {
      const result = actions.deleteNode('node-2');

      expect(result).toBe(true);
      expect(state.nodes['node-2']).toBeUndefined();
      expect(state.nodes['root'].children).toEqual(['node-1']);
    });

    it('should return false when node has children and not confirmed', () => {
      const result = actions.deleteNode('node-1');

      expect(result).toBe(false);
      expect(state.nodes['node-1']).toBeDefined();
      expect(state.nodes['root'].children).toEqual(['node-1', 'node-2']);
    });

    it('should delete node with children when confirmed', () => {
      const result = actions.deleteNode('node-1', true);

      expect(result).toBe(true);
      expect(state.nodes['node-1']).toBeUndefined();
      expect(state.nodes['root'].children).toEqual(['node-2']);
    });

    it('should recursively delete all descendants', () => {
      actions.deleteNode('node-1', true);

      expect(state.nodes['node-1']).toBeUndefined();
      expect(state.nodes['node-3']).toBeUndefined();
    });

    it('should update ancestor registry after deletion', () => {
      actions.deleteNode('node-1', true);

      expect(state.ancestorRegistry['node-1']).toBeUndefined();
      expect(state.ancestorRegistry['node-3']).toBeUndefined();
      expect(state.ancestorRegistry['node-2']).toEqual(['root']);
    });

    it('should return true when deleting non-existent node', () => {
      const result = actions.deleteNode('non-existent');

      expect(result).toBe(true);
    });

    it('should handle deleting deeply nested nodes', () => {
      state.nodes['node-3'].children = ['node-4', 'node-5'];
      state.nodes['node-4'] = {
        id: 'node-4',
        type: 'task',
        content: 'Task 4',
        children: [],
        metadata: { status: '☐' },
      };
      state.nodes['node-5'] = {
        id: 'node-5',
        type: 'task',
        content: 'Task 5',
        children: ['node-6'],
        metadata: { status: '☐' },
      };
      state.nodes['node-6'] = {
        id: 'node-6',
        type: 'task',
        content: 'Task 6',
        children: [],
        metadata: { status: '☐' },
      };
      state.ancestorRegistry['node-4'] = ['root', 'node-1', 'node-3'];
      state.ancestorRegistry['node-5'] = ['root', 'node-1', 'node-3'];
      state.ancestorRegistry['node-6'] = ['root', 'node-1', 'node-3', 'node-5'];

      actions.deleteNode('node-3', true);

      expect(state.nodes['node-3']).toBeUndefined();
      expect(state.nodes['node-4']).toBeUndefined();
      expect(state.nodes['node-5']).toBeUndefined();
      expect(state.nodes['node-6']).toBeUndefined();
      expect(state.nodes['node-1'].children).toEqual([]);
    });

    it('should update parent children array correctly', () => {
      state.nodes['root'].children = ['node-1', 'node-2', 'node-7'];
      state.nodes['node-7'] = {
        id: 'node-7',
        type: 'task',
        content: 'Task 7',
        children: [],
        metadata: { status: '☐' },
      };
      state.ancestorRegistry['node-7'] = ['root'];

      actions.deleteNode('node-2');

      expect(state.nodes['root'].children).toEqual(['node-1', 'node-7']);
    });
  });
});
