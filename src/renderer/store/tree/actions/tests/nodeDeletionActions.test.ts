import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNodeDeletionActions } from '../nodeDeletionActions';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../../../services/ancestry';

describe('nodeDeletionActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: AncestorRegistry;
    activeNodeId?: string | null;
    cursorPosition?: number;
    actions?: { executeCommand?: (cmd: unknown) => void };
  };
  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createNodeDeletionActions>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockExecuteCommand = vi.fn((command: { execute: () => void }) => {
      // Execute the command immediately in tests
      command.execute();
    });

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
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'node-1': ['root'],
        'node-2': ['root'],
        'node-3': ['root', 'node-1'],
      },
      actions: { executeCommand: mockExecuteCommand },
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
      expect(state.nodes['node-3']).toBeUndefined(); // Child should also be deleted
      expect(state.nodes['root'].children).toEqual(['node-2']);
    });

    it('should clear content when deleting last root-level child', () => {
      // Set up a scenario with only one child under root
      state.nodes = {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['last-child'],
          metadata: {},
        },
        'last-child': {
          id: 'last-child',
          content: 'Last child',
          children: [],
          metadata: {},
        },
      };
      state.ancestorRegistry = {
        'root': [],
        'last-child': ['root'],
      };

      // Delete the last child - should just clear its content
      const result = actions.deleteNode('last-child');

      expect(result).toBe(true);
      expect(state.nodes['last-child']).toBeDefined();
      expect(state.nodes['last-child'].content).toBe('');
      expect(state.nodes['root'].children).toEqual(['last-child']);
    });

    it('should return true when node does not exist', () => {
      const result = actions.deleteNode('non-existent');

      expect(result).toBe(true);
    });

    it('should select previous node after deletion', () => {
      actions.deleteNode('node-2');

      // Should select node-3 (deepest previous node in tree)
      // This is correct as findPreviousNode returns the deepest last descendant
      expect(state.activeNodeId).toBe('node-3');
    });

    it('should recursively delete all descendants', () => {
      // node-1 has node-3 as a child
      const result = actions.deleteNode('node-1', true);

      expect(result).toBe(true);
      expect(state.nodes['node-1']).toBeUndefined();
      expect(state.nodes['node-3']).toBeUndefined();
      expect(state.nodes['root'].children).toEqual(['node-2']);
    });
  });
});
