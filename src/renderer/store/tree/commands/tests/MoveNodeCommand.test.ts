import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MoveNodeCommand } from '../MoveNodeCommand';
import { TreeNode } from '../../../../../shared/types';

describe('MoveNodeCommand', () => {
  let nodes: Record<string, TreeNode>;
  let rootNodeId: string;
  let ancestorRegistry: Record<string, string[]>;
  let getState: ReturnType<typeof vi.fn>;
  let setState: ReturnType<typeof vi.fn>;
  let triggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    rootNodeId = 'root';
    nodes = {
      root: {
        id: 'root',
        content: 'Root',
        children: ['child1', 'child2', 'child3'],
        metadata: {},
      },
      child1: {
        id: 'child1',
        content: 'Child 1',
        children: [],
        metadata: { status: 'pending' },
      },
      child2: {
        id: 'child2',
        content: 'Child 2',
        children: [],
        metadata: { status: 'completed' },
      },
      child3: {
        id: 'child3',
        content: 'Child 3',
        children: [],
        metadata: { status: 'abandoned' },
      },
    };

    ancestorRegistry = {
      child1: ['root'],
      child2: ['root'],
      child3: ['root'],
    };

    getState = vi.fn(() => ({ nodes, rootNodeId, ancestorRegistry }));
    setState = vi.fn((partial) => {
      if (partial.nodes) nodes = partial.nodes;
      if (partial.ancestorRegistry) ancestorRegistry = partial.ancestorRegistry;
    });
    triggerAutosave = vi.fn();
  });

  describe('execute', () => {
    it('should move node to new position in same parent', () => {
      // Move child1 from position 0 to position 2
      const cmd = new MoveNodeCommand(
        'child1',
        'root',
        2,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['root'].children).toEqual(['child2', 'child3', 'child1']);
    });

    it('should move node to different parent', () => {
      // Add child2 as a parent first
      nodes.child2.children = [];

      const cmd = new MoveNodeCommand(
        'child1',
        'child2',
        0,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['root'].children).toEqual(['child2', 'child3']);
      expect(stateUpdate.nodes['child2'].children).toEqual(['child1']);
    });

    it('should select moved node and place cursor at end', () => {
      const cmd = new MoveNodeCommand(
        'child1',
        'root',
        2,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.activeNodeId).toBe('child1');
      expect(stateUpdate.cursorPosition).toBe(7); // Length of "Child 1"
    });

    it('should trigger autosave', () => {
      const cmd = new MoveNodeCommand(
        'child1',
        'root',
        2,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      expect(triggerAutosave).toHaveBeenCalled();
    });
  });

  describe('undo', () => {
    it('should restore node to original position', () => {
      const cmd = new MoveNodeCommand(
        'child1',
        'root',
        2,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();
      setState.mockClear();
      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['root'].children).toEqual(['child1', 'child2', 'child3']);
    });

    it('should restore node to original parent', () => {
      nodes.child2.children = [];

      const cmd = new MoveNodeCommand(
        'child1',
        'child2',
        0,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();
      setState.mockClear();
      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['root'].children).toEqual(['child1', 'child2', 'child3']);
      expect(stateUpdate.nodes['child2'].children).toEqual([]);
    });

    it('should select moved node and place cursor at end', () => {
      const cmd = new MoveNodeCommand(
        'child1',
        'root',
        2,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();
      setState.mockClear();
      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.activeNodeId).toBe('child1');
      expect(stateUpdate.cursorPosition).toBe(7); // Length of "Child 1"
    });

    it('should trigger autosave on undo', () => {
      const cmd = new MoveNodeCommand(
        'child1',
        'root',
        2,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();
      triggerAutosave.mockClear();
      cmd.undo();

      expect(triggerAutosave).toHaveBeenCalled();
    });
  });

  describe('redo', () => {
    it('should move node to new position again', () => {
      const cmd = new MoveNodeCommand(
        'child1',
        'root',
        2,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();
      cmd.undo();
      setState.mockClear();
      cmd.redo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['root'].children).toEqual(['child2', 'child3', 'child1']);
    });
  });
});
