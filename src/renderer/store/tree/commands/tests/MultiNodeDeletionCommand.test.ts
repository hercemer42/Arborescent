import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MultiNodeDeletionCommand } from '../MultiNodeDeletionCommand';
import type { TreeNode } from '../../../../../shared/types';

describe('MultiNodeDeletionCommand', () => {
  let nodes: Record<string, TreeNode>;
  let ancestorRegistry: Record<string, string[]>;
  const rootNodeId = 'root';
  let setState: ReturnType<typeof vi.fn>;
  let findPreviousNode: ReturnType<typeof vi.fn>;
  let triggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nodes = {
      root: { id: 'root', content: 'Root', children: ['node-1', 'node-2'], metadata: {} },
      'node-1': { id: 'node-1', content: 'Node 1', children: ['node-1a'], metadata: {} },
      'node-1a': { id: 'node-1a', content: 'Node 1a', children: [], metadata: {} },
      'node-2': { id: 'node-2', content: 'Node 2', children: [], metadata: {} },
    };

    ancestorRegistry = {
      root: [],
      'node-1': ['root'],
      'node-1a': ['root', 'node-1'],
      'node-2': ['root'],
    };

    setState = vi.fn((partial) => {
      if (partial.nodes) nodes = partial.nodes;
      if (partial.ancestorRegistry) ancestorRegistry = partial.ancestorRegistry;
    });

    findPreviousNode = vi.fn().mockReturnValue('root');
    triggerAutosave = vi.fn();
  });

  describe('execute', () => {
    it('should delete a single node and its descendants', () => {
      const command = new MultiNodeDeletionCommand(
        ['node-1'],
        () => ({ nodes, rootNodeId, ancestorRegistry }),
        setState,
        findPreviousNode,
        triggerAutosave
      );

      command.execute();

      expect(setState).toHaveBeenCalled();
      const setStateCall = setState.mock.calls[0][0];
      expect(setStateCall.nodes['node-1']).toBeUndefined();
      expect(setStateCall.nodes['node-1a']).toBeUndefined();
      expect(setStateCall.nodes['root'].children).toEqual(['node-2']);
      expect(triggerAutosave).toHaveBeenCalled();
    });

    it('should delete multiple nodes', () => {
      const command = new MultiNodeDeletionCommand(
        ['node-1', 'node-2'],
        () => ({ nodes, rootNodeId, ancestorRegistry }),
        setState,
        findPreviousNode,
        triggerAutosave
      );

      command.execute();

      const setStateCall = setState.mock.calls[0][0];
      expect(setStateCall.nodes['node-1']).toBeUndefined();
      expect(setStateCall.nodes['node-2']).toBeUndefined();
      expect(setStateCall.nodes['root'].children).toEqual([]);
    });

    it('should clear multi-selection after delete', () => {
      const command = new MultiNodeDeletionCommand(
        ['node-2'],
        () => ({ nodes, rootNodeId, ancestorRegistry }),
        setState,
        findPreviousNode,
        triggerAutosave
      );

      command.execute();

      const setStateCall = setState.mock.calls[0][0];
      expect(setStateCall.multiSelectedNodeIds).toEqual(new Set());
    });

    it('should select previous node after deletion', () => {
      findPreviousNode.mockReturnValue('node-1');

      const command = new MultiNodeDeletionCommand(
        ['node-2'],
        () => ({ nodes, rootNodeId, ancestorRegistry }),
        setState,
        findPreviousNode,
        triggerAutosave
      );

      command.execute();

      const setStateCall = setState.mock.calls[0][0];
      expect(setStateCall.activeNodeId).toBe('node-1');
    });

    it('should fall back to root if no previous node', () => {
      findPreviousNode.mockReturnValue(null);

      const command = new MultiNodeDeletionCommand(
        ['node-1'],
        () => ({ nodes, rootNodeId, ancestorRegistry }),
        setState,
        findPreviousNode,
        triggerAutosave
      );

      command.execute();

      const setStateCall = setState.mock.calls[0][0];
      expect(setStateCall.activeNodeId).toBe('root');
    });
  });

  describe('undo', () => {
    it('should restore deleted node', () => {
      const command = new MultiNodeDeletionCommand(
        ['node-2'],
        () => ({ nodes, rootNodeId, ancestorRegistry }),
        setState,
        findPreviousNode,
        triggerAutosave
      );

      command.execute();

      // Update nodes to reflect deleted state
      const deletedNodes = setState.mock.calls[0][0].nodes;
      nodes = deletedNodes;

      setState.mockClear();
      triggerAutosave.mockClear();

      command.undo();

      const setStateCall = setState.mock.calls[0][0];
      expect(setStateCall.nodes['node-2']).toBeDefined();
      expect(setStateCall.nodes['node-2'].content).toBe('Node 2');
      expect(setStateCall.nodes['root'].children).toContain('node-2');
      expect(triggerAutosave).toHaveBeenCalled();
    });

    it('should restore deleted node with descendants', () => {
      const command = new MultiNodeDeletionCommand(
        ['node-1'],
        () => ({ nodes, rootNodeId, ancestorRegistry }),
        setState,
        findPreviousNode,
        triggerAutosave
      );

      command.execute();

      const deletedNodes = setState.mock.calls[0][0].nodes;
      nodes = deletedNodes;

      setState.mockClear();

      command.undo();

      const setStateCall = setState.mock.calls[0][0];
      expect(setStateCall.nodes['node-1']).toBeDefined();
      expect(setStateCall.nodes['node-1a']).toBeDefined();
      expect(setStateCall.nodes['node-1'].children).toContain('node-1a');
    });

    it('should restore multiple deleted nodes in correct positions', () => {
      const command = new MultiNodeDeletionCommand(
        ['node-1', 'node-2'],
        () => ({ nodes, rootNodeId, ancestorRegistry }),
        setState,
        findPreviousNode,
        triggerAutosave
      );

      command.execute();

      const deletedNodes = setState.mock.calls[0][0].nodes;
      nodes = deletedNodes;

      setState.mockClear();

      command.undo();

      const setStateCall = setState.mock.calls[0][0];
      expect(setStateCall.nodes['node-1']).toBeDefined();
      expect(setStateCall.nodes['node-2']).toBeDefined();
      // Should restore in original order
      expect(setStateCall.nodes['root'].children).toEqual(['node-1', 'node-2']);
    });

    it('should select first restored node', () => {
      const command = new MultiNodeDeletionCommand(
        ['node-1', 'node-2'],
        () => ({ nodes, rootNodeId, ancestorRegistry }),
        setState,
        findPreviousNode,
        triggerAutosave
      );

      command.execute();

      const deletedNodes = setState.mock.calls[0][0].nodes;
      nodes = deletedNodes;

      setState.mockClear();

      command.undo();

      const setStateCall = setState.mock.calls[0][0];
      expect(setStateCall.activeNodeId).toBe('node-1');
    });

    it('should set cursor to end of restored node content', () => {
      const command = new MultiNodeDeletionCommand(
        ['node-1'],
        () => ({ nodes, rootNodeId, ancestorRegistry }),
        setState,
        findPreviousNode,
        triggerAutosave
      );

      command.execute();

      const deletedNodes = setState.mock.calls[0][0].nodes;
      nodes = deletedNodes;

      setState.mockClear();

      command.undo();

      const setStateCall = setState.mock.calls[0][0];
      expect(setStateCall.cursorPosition).toBe('Node 1'.length);
    });
  });

  describe('getDeletedNodeIds', () => {
    it('should return the node IDs that were deleted', () => {
      const command = new MultiNodeDeletionCommand(
        ['node-1', 'node-2'],
        () => ({ nodes, rootNodeId, ancestorRegistry }),
        setState,
        findPreviousNode,
        triggerAutosave
      );

      expect(command.getDeletedNodeIds()).toEqual(['node-1', 'node-2']);
    });
  });

  describe('edge cases', () => {
    it('should handle non-existent node IDs gracefully', () => {
      const command = new MultiNodeDeletionCommand(
        ['non-existent'],
        () => ({ nodes, rootNodeId, ancestorRegistry }),
        setState,
        findPreviousNode,
        triggerAutosave
      );

      expect(() => command.execute()).not.toThrow();
    });

    it('should handle empty node list', () => {
      const command = new MultiNodeDeletionCommand(
        [],
        () => ({ nodes, rootNodeId, ancestorRegistry }),
        setState,
        findPreviousNode,
        triggerAutosave
      );

      command.execute();

      // Should still call setState but with minimal changes
      expect(setState).toHaveBeenCalled();
    });
  });
});
