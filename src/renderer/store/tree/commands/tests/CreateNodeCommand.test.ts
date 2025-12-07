import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CreateNodeCommand } from '../CreateNodeCommand';
import { TreeNode } from '../../../../../shared/types';
import { AncestorRegistry } from '../../../../services/ancestry';

describe('CreateNodeCommand', () => {
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
    it('should create a new node with default pending status', () => {
      const cmd = new CreateNodeCommand(
        'newNode',
        'root',
        1,
        'New content',
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['newNode']).toEqual({
        id: 'newNode',
        content: 'New content',
        children: [],
        metadata: { status: 'pending' },
      });
    });

    it('should insert node at correct position', () => {
      const cmd = new CreateNodeCommand(
        'newNode',
        'root',
        1,
        '',
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['root'].children).toEqual(['child1', 'newNode', 'child2']);
    });

    it('should insert at beginning when position is 0', () => {
      const cmd = new CreateNodeCommand(
        'newNode',
        'root',
        0,
        '',
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['root'].children).toEqual(['newNode', 'child1', 'child2']);
    });

    it('should insert at end when position is after last child', () => {
      const cmd = new CreateNodeCommand(
        'newNode',
        'root',
        2,
        '',
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['root'].children).toEqual(['child1', 'child2', 'newNode']);
    });

    it('should select new node with cursor at position 0', () => {
      const cmd = new CreateNodeCommand(
        'newNode',
        'root',
        1,
        'New content',
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.activeNodeId).toBe('newNode');
      expect(stateUpdate.cursorPosition).toBe(0);
    });

    it('should trigger autosave', () => {
      const cmd = new CreateNodeCommand(
        'newNode',
        'root',
        1,
        '',
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      expect(triggerAutosave).toHaveBeenCalled();
    });
  });

  describe('undo', () => {
    it('should remove the created node', () => {
      const cmd = new CreateNodeCommand(
        'newNode',
        'root',
        1,
        'New content',
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
      const cmd = new CreateNodeCommand(
        'newNode',
        'root',
        1,
        '',
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

    it('should select parent and place cursor at end', () => {
      const cmd = new CreateNodeCommand(
        'newNode',
        'root',
        1,
        '',
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();
      setState.mockClear();
      cmd.undo();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.activeNodeId).toBe('root');
      expect(stateUpdate.cursorPosition).toBe(4); // Length of "Root"
    });

    it('should trigger autosave on undo', () => {
      const cmd = new CreateNodeCommand(
        'newNode',
        'root',
        1,
        '',
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
    it('should NOT inherit isBlueprint from regular blueprint parent', () => {
      nodes['child1'].metadata.isBlueprint = true;

      const cmd = new CreateNodeCommand(
        'newNode',
        'child1',
        0,
        'New content',
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['newNode'].metadata.isBlueprint).toBeUndefined();
    });

    it('should inherit isBlueprint from context declaration parent', () => {
      nodes['child1'].metadata.isContextDeclaration = true;
      nodes['child1'].metadata.isBlueprint = true;

      const cmd = new CreateNodeCommand(
        'newNode',
        'child1',
        0,
        'New content',
        getState,
        setState,
        triggerAutosave
      );

      cmd.execute();

      const stateUpdate = setState.mock.calls[0][0];
      expect(stateUpdate.nodes['newNode'].metadata.isBlueprint).toBe(true);
    });

    it('should inherit isBlueprint from context child parent', () => {
      // Set up: root is context declaration, child1 is context child (derived)
      nodes['root'].metadata.isContextDeclaration = true;
      nodes['root'].metadata.isBlueprint = true;
      nodes['child1'].metadata.isBlueprint = true;

      const cmd = new CreateNodeCommand(
        'newNode',
        'child1',
        0,
        'New content',
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
