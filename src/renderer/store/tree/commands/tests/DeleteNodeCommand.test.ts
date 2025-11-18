import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteNodeCommand } from '../DeleteNodeCommand';
import { TreeNode } from '../../../../../shared/types';

describe('DeleteNodeCommand', () => {
  let nodes: Record<string, TreeNode>;
  let rootNodeId: string;
  let ancestorRegistry: Record<string, string[]>;
  let getState: ReturnType<typeof vi.fn>;
  let setState: ReturnType<typeof vi.fn>;
  let findPreviousNode: ReturnType<typeof vi.fn>;
  let triggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rootNodeId = 'root';
    nodes = {
      root: {
        id: 'root',
        content: 'Root',
        children: ['child1', 'child2'],
        metadata: {},
      },
      child1: {
        id: 'child1',
        content: 'Child 1',
        children: ['grandchild1'],
        metadata: { status: 'pending' },
      },
      grandchild1: {
        id: 'grandchild1',
        content: 'Grandchild 1',
        children: [],
        metadata: { status: 'completed' },
      },
      child2: {
        id: 'child2',
        content: 'Child 2',
        children: [],
        metadata: { status: 'failed' },
      },
    };

    ancestorRegistry = {
      child1: ['root'],
      child2: ['root'],
      grandchild1: ['root', 'child1'],
    };

    getState = vi.fn(() => ({ nodes, rootNodeId, ancestorRegistry }));
    setState = vi.fn((partial) => {
      if (partial.nodes) nodes = partial.nodes;
      if (partial.ancestorRegistry) ancestorRegistry = partial.ancestorRegistry;
    });
    findPreviousNode = vi.fn(() => null);
    triggerAutosave = vi.fn();
  });

  describe('execute', () => {
    it('should delete a leaf node', () => {
      const cmd = new DeleteNodeCommand(
        'child2',
        getState,
        setState,
        findPreviousNode,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['child2']).toBeUndefined();
      expect(stateUpdate.nodes['root'].children).toEqual(['child1']);
      expect(triggerAutosave).toHaveBeenCalled();
    });

    it('should delete a node with descendants', () => {
      const cmd = new DeleteNodeCommand(
        'child1',
        getState,
        setState,
        findPreviousNode,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['child1']).toBeUndefined();
      expect(stateUpdate.nodes['grandchild1']).toBeUndefined();
      expect(stateUpdate.nodes['root'].children).toEqual(['child2']);
    });

    it('should select previous node if available', () => {
      findPreviousNode.mockReturnValue('child1');

      const cmd = new DeleteNodeCommand(
        'child2',
        getState,
        setState,
        findPreviousNode,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.activeNodeId).toBe('child1');
    });

    it('should select parent if no previous node', () => {
      findPreviousNode.mockReturnValue(null);

      const cmd = new DeleteNodeCommand(
        'child1',
        getState,
        setState,
        findPreviousNode,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.activeNodeId).toBe('root');
    });

    it('should place cursor at end of selected node', () => {
      findPreviousNode.mockReturnValue('child2');

      const cmd = new DeleteNodeCommand(
        'child1',
        getState,
        setState,
        findPreviousNode,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.cursorPosition).toBe(7); // Length of "Child 2"
    });
  });

  describe('undo', () => {
    it('should restore deleted leaf node', () => {
      const cmd = new DeleteNodeCommand(
        'child2',
        getState,
        setState,
        findPreviousNode,
        triggerAutosave
      );

      cmd.execute();
      setState.mockClear();
      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['child2']).toEqual({
        id: 'child2',
        content: 'Child 2',
        children: [],
        metadata: { status: 'failed' },
      });
      expect(stateUpdate.nodes['root'].children).toEqual(['child1', 'child2']);
    });

    it('should restore deleted node with all descendants', () => {
      const cmd = new DeleteNodeCommand(
        'child1',
        getState,
        setState,
        findPreviousNode,
        triggerAutosave
      );

      cmd.execute();
      setState.mockClear();
      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['child1']).toBeDefined();
      expect(stateUpdate.nodes['grandchild1']).toBeDefined();
      expect(stateUpdate.nodes['child1'].children).toEqual(['grandchild1']);
    });

    it('should restore node at correct position', () => {
      const cmd = new DeleteNodeCommand(
        'child1',
        getState,
        setState,
        findPreviousNode,
        triggerAutosave
      );

      cmd.execute();
      setState.mockClear();
      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['root'].children).toEqual(['child1', 'child2']);
    });

    it('should restore node metadata', () => {
      const cmd = new DeleteNodeCommand(
        'child1',
        getState,
        setState,
        findPreviousNode,
        triggerAutosave
      );

      cmd.execute();
      setState.mockClear();
      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['child1'].metadata).toEqual({ status: 'pending' });
      expect(stateUpdate.nodes['grandchild1'].metadata).toEqual({ status: 'completed' });
    });

    it('should select restored node and place cursor at end', () => {
      const cmd = new DeleteNodeCommand(
        'child1',
        getState,
        setState,
        findPreviousNode,
        triggerAutosave
      );

      cmd.execute();
      setState.mockClear();
      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.activeNodeId).toBe('child1');
      expect(stateUpdate.cursorPosition).toBe(7); // Length of "Child 1"
    });
  });
});
