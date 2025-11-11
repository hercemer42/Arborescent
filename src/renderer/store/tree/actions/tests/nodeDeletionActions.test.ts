import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNodeDeletionActions } from '../nodeDeletionActions';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../../../utils/ancestry';
import type { DeletedNodeEntry, DeletedNodeInfo } from '../../treeStore';

describe('nodeDeletionActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    deletedNodesMap: Record<string, DeletedNodeInfo>;
    rootNodeId: string;
    ancestorRegistry: AncestorRegistry;
    activeNodeId?: string | null;
    cursorPosition?: number;
    deletedNodes: DeletedNodeEntry[];
  };
  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createNodeDeletionActions>;

  beforeEach(() => {
    state = {
      nodes: {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['node-1', 'node-2'],
          metadata: {},
        },
        'node-1': {
          id: 'node-1',
          content: 'Task 1',
          children: ['node-3'],
          metadata: { status: 'pending' },
        },
        'node-2': {
          id: 'node-2',
          content: 'Task 2',
          children: [],
          metadata: { status: 'pending' },
        },
        'node-3': {
          id: 'node-3',
          content: 'Task 3',
          children: [],
          metadata: { status: 'pending' },
        },
      },
      deletedNodesMap: {},
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'node-1': ['root'],
        'node-2': ['root'],
        'node-3': ['root', 'node-1'],
      },
      deletedNodes: [],
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    actions = createNodeDeletionActions(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => state as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState as any
    );
  });

  describe('deleteNode', () => {
    it('should delete node without children and return true', () => {
      const result = actions.deleteNode('node-2');

      expect(result).toBe(true);
      expect(state.nodes['node-2']).toBeUndefined();
      expect(state.deletedNodesMap['node-2']).toBeDefined();
      expect(state.deletedNodesMap['node-2'].originalParentId).toBe('root');
      expect(state.nodes['root'].children).toEqual(['node-1']);
    });

    it('should return false when node has children and not confirmed', () => {
      const result = actions.deleteNode('node-1');

      expect(result).toBe(false);
      expect(state.nodes['node-1']).toBeDefined();
      expect(state.nodes['root'].children).toEqual(['node-1', 'node-2']);
    });

    it('should not require confirmation if all children are already deleted', () => {
      actions.deleteNode('node-3');
      expect(state.deletedNodesMap['node-3']).toBeDefined();

      const result = actions.deleteNode('node-1', false);

      expect(result).toBe(true);
      expect(state.deletedNodesMap['node-1']).toBeDefined();
    });

    it('should delete node with children when confirmed', () => {
      const result = actions.deleteNode('node-1', true);

      expect(result).toBe(true);
      expect(state.nodes['node-1']).toBeUndefined();
      expect(state.deletedNodesMap['node-1']).toBeDefined();
      expect(state.nodes['root'].children).toEqual(['node-2']);
    });

    it('should recursively delete all descendants', () => {
      actions.deleteNode('node-1', true);

      expect(state.nodes['node-1']).toBeUndefined();
      expect(state.deletedNodesMap['node-1']).toBeDefined();
      expect(state.nodes['node-3']).toBeUndefined();
      expect(state.deletedNodesMap['node-3']).toBeDefined();
    });

    it('should keep deleted nodes in ancestor registry', () => {
      actions.deleteNode('node-1', true);

      expect(state.ancestorRegistry['node-1']).toEqual(['root']);
      expect(state.ancestorRegistry['node-3']).toEqual(['root', 'node-1']);
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
        content: 'Task 4',
        children: [],
        metadata: { status: 'pending' },
      };
      state.nodes['node-5'] = {
        id: 'node-5',
        content: 'Task 5',
        children: ['node-6'],
        metadata: { status: 'pending' },
      };
      state.nodes['node-6'] = {
        id: 'node-6',
        content: 'Task 6',
        children: [],
        metadata: { status: 'pending' },
      };
      state.ancestorRegistry['node-4'] = ['root', 'node-1', 'node-3'];
      state.ancestorRegistry['node-5'] = ['root', 'node-1', 'node-3'];
      state.ancestorRegistry['node-6'] = ['root', 'node-1', 'node-3', 'node-5'];

      actions.deleteNode('node-3', true);

      expect(state.nodes['node-3']).toBeUndefined();
      expect(state.deletedNodesMap['node-3']).toBeDefined();
      expect(state.nodes['node-4']).toBeUndefined();
      expect(state.deletedNodesMap['node-4']).toBeDefined();
      expect(state.nodes['node-5']).toBeUndefined();
      expect(state.deletedNodesMap['node-5']).toBeDefined();
      expect(state.nodes['node-6']).toBeUndefined();
      expect(state.deletedNodesMap['node-6']).toBeDefined();
      expect(state.nodes['node-1'].children).toEqual([]);
    });

    it('should remove deleted node from parent children array', () => {
      state.nodes['root'].children = ['node-1', 'node-2', 'node-7'];
      state.nodes['node-7'] = {
        id: 'node-7',
        content: 'Task 7',
        children: [],
        metadata: { status: 'pending' },
      };
      state.ancestorRegistry['node-7'] = ['root'];

      actions.deleteNode('node-2');

      expect(state.nodes['root'].children).toEqual(['node-1', 'node-7']);
    });
  });

  describe('soft delete system', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it('should move node to deletedNodesMap with timestamp', () => {
      const beforeDelete = Date.now();
      vi.setSystemTime(beforeDelete);

      actions.deleteNode('node-2');

      expect(state.nodes['node-2']).toBeUndefined();
      expect(state.deletedNodesMap['node-2']).toBeDefined();
      expect(state.deletedNodesMap['node-2'].deletedAt).toBe(beforeDelete);
    });

    it('should recursively move children to deletedNodesMap', () => {
      const beforeDelete = Date.now();
      vi.setSystemTime(beforeDelete);

      actions.deleteNode('node-1', true);

      expect(state.deletedNodesMap['node-1']).toBeDefined();
      expect(state.deletedNodesMap['node-3']).toBeDefined();
      expect(state.deletedNodesMap['node-1'].deletedAt).toBe(beforeDelete);
      expect(state.deletedNodesMap['node-3'].deletedAt).toBe(beforeDelete);
    });

    it('should track deleted node in deletedNodes buffer', () => {
      actions.deleteNode('node-2');

      expect(state.deletedNodes).toHaveLength(1);
      expect(state.deletedNodes[0].rootNodeId).toBe('node-2');
    });

    it('should remove node from parent children array', () => {
      actions.deleteNode('node-2');

      expect(state.nodes['root'].children).toEqual(['node-1']);
    });

    it('should purge oldest deleted nodes when buffer exceeds 10', () => {
      for (let i = 1; i <= 12; i++) {
        const nodeId = `delete-${i}`;
        state.nodes['root'].children.push(nodeId);
        state.nodes[nodeId] = {
          id: nodeId,
          content: `Delete ${i}`,
          children: [],
          metadata: {},
        };
        state.ancestorRegistry[nodeId] = ['root'];
        actions.deleteNode(nodeId);
      }

      expect(state.deletedNodes).toHaveLength(10);
      expect(state.deletedNodesMap['delete-1']).toBeUndefined();
      expect(state.deletedNodesMap['delete-2']).toBeUndefined();
      expect(state.deletedNodesMap['delete-3']).toBeDefined();
      expect(state.deletedNodesMap['delete-12']).toBeDefined();
    });

    it('should undelete the last deleted node', () => {
      actions.deleteNode('node-2');

      expect(state.deletedNodesMap['node-2']).toBeDefined();
      expect(state.nodes['root'].children).toEqual(['node-1']);

      const success = actions.undeleteNode();

      expect(success).toBe(true);
      expect(state.nodes['node-2']).toBeDefined();
      expect(state.deletedNodesMap['node-2']).toBeUndefined();
      expect(state.nodes['root'].children).toEqual(['node-1', 'node-2']);
    });

    it('should undelete node with entire subtree', () => {
      actions.deleteNode('node-1', true);

      expect(state.deletedNodesMap['node-1']).toBeDefined();
      expect(state.deletedNodesMap['node-3']).toBeDefined();

      actions.undeleteNode();

      expect(state.nodes['node-1']).toBeDefined();
      expect(state.nodes['node-3']).toBeDefined();
      expect(state.nodes['root'].children).toContain('node-1');
    });

    it('should remove node from deletedNodes buffer after undelete', () => {
      actions.deleteNode('node-2');

      expect(state.deletedNodes).toHaveLength(1);

      actions.undeleteNode();

      expect(state.deletedNodes).toHaveLength(0);
    });

    it('should return false when undeleting with empty buffer', () => {
      const success = actions.undeleteNode();

      expect(success).toBe(false);
    });

    it('should handle multiple delete/undelete cycles', () => {
      actions.deleteNode('node-2');
      expect(state.deletedNodes).toHaveLength(1);

      actions.undeleteNode();
      expect(state.deletedNodes).toHaveLength(0);
      expect(state.nodes['node-2']).toBeDefined();
      expect(state.deletedNodesMap['node-2']).toBeUndefined();

      actions.deleteNode('node-2');
      expect(state.deletedNodes).toHaveLength(1);
      expect(state.deletedNodesMap['node-2']).toBeDefined();
    });

    it('should purge all deleted nodes permanently', () => {
      actions.deleteNode('node-2');
      actions.deleteNode('node-3');

      expect(state.deletedNodesMap['node-2']).toBeDefined();
      expect(state.deletedNodesMap['node-3']).toBeDefined();
      expect(state.deletedNodes).toHaveLength(2);

      actions.purgeOldDeletedNodes();

      expect(state.deletedNodesMap['node-2']).toBeUndefined();
      expect(state.deletedNodesMap['node-3']).toBeUndefined();
      expect(state.deletedNodes).toHaveLength(0);
    });

    it('should handle sequential undo when child deleted before parent', () => {
      // Delete child first
      actions.deleteNode('node-3');
      expect(state.deletedNodesMap['node-3']).toBeDefined();
      expect(state.deletedNodes).toHaveLength(1);
      const childBufferId = state.deletedNodesMap['node-3'].deleteBufferId;

      // Delete parent (node-1 has node-3 as child, which is already deleted)
      actions.deleteNode('node-1', true);
      expect(state.deletedNodesMap['node-1']).toBeDefined();
      expect(state.deletedNodes).toHaveLength(2);
      const parentBufferId = state.deletedNodesMap['node-1'].deleteBufferId;

      // Child should still have its original buffer ID
      expect(state.deletedNodesMap['node-3'].deleteBufferId).toBe(childBufferId);
      // Parent should have a different buffer ID
      expect(parentBufferId).not.toBe(childBufferId);

      // First undo should restore only the parent
      actions.undeleteNode();
      expect(state.nodes['node-1']).toBeDefined();
      expect(state.deletedNodesMap['node-3']).toBeDefined(); // Child still deleted
      expect(state.deletedNodes).toHaveLength(1);

      // Second undo should restore the child
      actions.undeleteNode();
      expect(state.nodes['node-3']).toBeDefined();
      expect(state.deletedNodes).toHaveLength(0);
    });
  });
});
