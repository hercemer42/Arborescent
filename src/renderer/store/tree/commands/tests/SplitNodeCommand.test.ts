import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SplitNodeCommand } from '../SplitNodeCommand';
import { TreeNode } from '../../../../../shared/types';
import { AncestorRegistry } from '../../../../services/ancestry';

describe('SplitNodeCommand', () => {
  let nodes: Record<string, TreeNode>;
  let rootNodeId: string;
  let ancestorRegistry: AncestorRegistry;
  let getState: ReturnType<typeof vi.fn>;
  let setState: ReturnType<typeof vi.fn>;
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
        content: 'Hello World',
        children: [],
        metadata: { status: 'pending' },
      },
      child2: {
        id: 'child2',
        content: 'Second child',
        children: [],
        metadata: { status: 'completed' },
      },
    };

    ancestorRegistry = {
      root: [],
      child1: ['root'],
      child2: ['root'],
    };

    getState = vi.fn(() => ({ nodes, rootNodeId, ancestorRegistry }));
    setState = vi.fn((partial) => {
      if (partial.nodes) nodes = partial.nodes;
      if (partial.ancestorRegistry) ancestorRegistry = partial.ancestorRegistry;
    });
    triggerAutosave = vi.fn();
  });

  describe('execute', () => {
    it('should split node content at cursor position', () => {
      const cmd = new SplitNodeCommand(
        'child1',
        'newNode',
        'Hello World',
        'Hello',
        ' World',
        5,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['child1'].content).toBe('Hello');
      expect(stateUpdate.nodes['newNode'].content).toBe(' World');
    });

    it('should create new sibling after source node', () => {
      const cmd = new SplitNodeCommand(
        'child1',
        'newNode',
        'Hello World',
        'Hello',
        ' World',
        5,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['root'].children).toEqual(['child1', 'newNode', 'child2']);
    });

    it('should set focus to new node at position 0', () => {
      const cmd = new SplitNodeCommand(
        'child1',
        'newNode',
        'Hello World',
        'Hello',
        ' World',
        5,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.activeNodeId).toBe('newNode');
      expect(stateUpdate.cursorPosition).toBe(0);
    });

    it('should create new node with pending status', () => {
      const cmd = new SplitNodeCommand(
        'child1',
        'newNode',
        'Hello World',
        'Hello',
        ' World',
        5,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['newNode'].metadata.status).toBe('pending');
    });

    it('should handle split at beginning (empty source node)', () => {
      const cmd = new SplitNodeCommand(
        'child1',
        'newNode',
        'Hello World',
        '',
        'Hello World',
        0,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['child1'].content).toBe('');
      expect(stateUpdate.nodes['newNode'].content).toBe('Hello World');
    });

    it('should trigger autosave', () => {
      const cmd = new SplitNodeCommand(
        'child1',
        'newNode',
        'Hello World',
        'Hello',
        ' World',
        5,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      expect(triggerAutosave).toHaveBeenCalled();
    });
  });

  describe('undo', () => {
    it('should restore original content to source node', () => {
      const cmd = new SplitNodeCommand(
        'child1',
        'newNode',
        'Hello World',
        'Hello',
        ' World',
        5,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();
      setState.mockClear();
      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['child1'].content).toBe('Hello World');
    });

    it('should remove the new node', () => {
      const cmd = new SplitNodeCommand(
        'child1',
        'newNode',
        'Hello World',
        'Hello',
        ' World',
        5,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();
      setState.mockClear();
      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['newNode']).toBeUndefined();
    });

    it('should restore parent children list', () => {
      const cmd = new SplitNodeCommand(
        'child1',
        'newNode',
        'Hello World',
        'Hello',
        ' World',
        5,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();
      setState.mockClear();
      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['root'].children).toEqual(['child1', 'child2']);
    });

    it('should restore focus to source node at original cursor position', () => {
      const cmd = new SplitNodeCommand(
        'child1',
        'newNode',
        'Hello World',
        'Hello',
        ' World',
        5,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();
      setState.mockClear();
      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.activeNodeId).toBe('child1');
      expect(stateUpdate.cursorPosition).toBe(5);
    });

    it('should trigger autosave on undo', () => {
      const cmd = new SplitNodeCommand(
        'child1',
        'newNode',
        'Hello World',
        'Hello',
        ' World',
        5,
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

  describe('blueprint inheritance', () => {
    it('should inherit isBlueprint from context declaration parent', () => {
      nodes['root'].metadata.isContextDeclaration = true;
      nodes['root'].metadata.isBlueprint = true;

      const cmd = new SplitNodeCommand(
        'child1',
        'newNode',
        'Hello World',
        'Hello',
        ' World',
        5,
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['newNode'].metadata.isBlueprint).toBe(true);
    });
  });
});
