import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteMultipleNodesCommand } from '../DeleteMultipleNodesCommand';
import { TreeNode } from '../../../../../shared/types';

describe('DeleteMultipleNodesCommand', () => {
  let nodes: Record<string, TreeNode>;
  let rootNodeId: string;
  let ancestorRegistry: Record<string, string[]>;
  let setState: ReturnType<typeof vi.fn>;
  let mockFindPreviousNode: ReturnType<typeof vi.fn>;
  let triggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Set up a tree structure:
    // root
    //   ├── node-1
    //   │   └── node-1-1
    //   ├── node-2
    //   │   └── node-2-1
    //   └── node-3
    nodes = {
      root: {
        id: 'root',
        content: 'Root',
        children: ['node-1', 'node-2', 'node-3'],
        metadata: {},
      },
      'node-1': {
        id: 'node-1',
        content: 'Node 1',
        children: ['node-1-1'],
        metadata: {},
      },
      'node-1-1': {
        id: 'node-1-1',
        content: 'Node 1-1',
        children: [],
        metadata: {},
      },
      'node-2': {
        id: 'node-2',
        content: 'Node 2',
        children: ['node-2-1'],
        metadata: {},
      },
      'node-2-1': {
        id: 'node-2-1',
        content: 'Node 2-1',
        children: [],
        metadata: {},
      },
      'node-3': {
        id: 'node-3',
        content: 'Node 3',
        children: [],
        metadata: {},
      },
    };

    rootNodeId = 'root';

    ancestorRegistry = {
      root: [],
      'node-1': ['root'],
      'node-1-1': ['root', 'node-1'],
      'node-2': ['root'],
      'node-2-1': ['root', 'node-2'],
      'node-3': ['root'],
    };

    setState = vi.fn((partial) => {
      if (partial.nodes) nodes = partial.nodes;
      if (partial.ancestorRegistry) ancestorRegistry = partial.ancestorRegistry;
    });

    mockFindPreviousNode = vi.fn(() => 'root');
    triggerAutosave = vi.fn();
  });

  const getState = () => ({ nodes, rootNodeId, ancestorRegistry });

  it('should delete multiple nodes on execute', () => {
    const command = new DeleteMultipleNodesCommand(
      ['node-1', 'node-3'],
      getState,
      setState,
      mockFindPreviousNode,
      triggerAutosave
    );

    command.execute();

    expect(setState).toHaveBeenCalled();
    const lastCall = setState.mock.calls[setState.mock.calls.length - 1][0];

    // node-1, node-1-1, and node-3 should be deleted
    expect(lastCall.nodes['node-1']).toBeUndefined();
    expect(lastCall.nodes['node-1-1']).toBeUndefined();
    expect(lastCall.nodes['node-3']).toBeUndefined();

    // node-2 and node-2-1 should still exist
    expect(lastCall.nodes['node-2']).toBeDefined();
    expect(lastCall.nodes['node-2-1']).toBeDefined();

    // Root's children should only have node-2
    expect(lastCall.nodes['root'].children).toEqual(['node-2']);
  });

  it('should restore all nodes on undo', () => {
    const command = new DeleteMultipleNodesCommand(
      ['node-1', 'node-3'],
      getState,
      setState,
      mockFindPreviousNode,
      triggerAutosave
    );

    command.execute();
    command.undo();

    const lastCall = setState.mock.calls[setState.mock.calls.length - 1][0];

    // All nodes should be restored
    expect(lastCall.nodes['node-1']).toBeDefined();
    expect(lastCall.nodes['node-1-1']).toBeDefined();
    expect(lastCall.nodes['node-3']).toBeDefined();

    // Check root's children restored in correct positions
    expect(lastCall.nodes['root'].children).toContain('node-1');
    expect(lastCall.nodes['root'].children).toContain('node-3');
  });

  it('should delete descendants of deleted nodes', () => {
    const command = new DeleteMultipleNodesCommand(
      ['node-2'],
      getState,
      setState,
      mockFindPreviousNode,
      triggerAutosave
    );

    command.execute();

    const lastCall = setState.mock.calls[setState.mock.calls.length - 1][0];

    // node-2 and its child node-2-1 should both be deleted
    expect(lastCall.nodes['node-2']).toBeUndefined();
    expect(lastCall.nodes['node-2-1']).toBeUndefined();
  });

  it('should clear multiSelectedNodeIds on execute', () => {
    const command = new DeleteMultipleNodesCommand(
      ['node-1'],
      getState,
      setState,
      mockFindPreviousNode,
      triggerAutosave
    );

    command.execute();

    const lastCall = setState.mock.calls[setState.mock.calls.length - 1][0];
    expect(lastCall.multiSelectedNodeIds).toEqual(new Set());
  });

  it('should trigger autosave on execute', () => {
    const command = new DeleteMultipleNodesCommand(
      ['node-1'],
      getState,
      setState,
      mockFindPreviousNode,
      triggerAutosave
    );

    command.execute();

    expect(triggerAutosave).toHaveBeenCalled();
  });

  it('should trigger autosave on undo', () => {
    const command = new DeleteMultipleNodesCommand(
      ['node-1'],
      getState,
      setState,
      mockFindPreviousNode,
      triggerAutosave
    );

    command.execute();
    triggerAutosave.mockClear();
    command.undo();

    expect(triggerAutosave).toHaveBeenCalled();
  });

  it('should have correct description', () => {
    const command = new DeleteMultipleNodesCommand(
      ['node-1', 'node-2', 'node-3'],
      getState,
      setState,
      mockFindPreviousNode,
      triggerAutosave
    );

    expect(command.description).toBe('Delete 3 node(s)');
  });

  it('should return deleted node IDs', () => {
    const command = new DeleteMultipleNodesCommand(
      ['node-1', 'node-3'],
      getState,
      setState,
      mockFindPreviousNode,
      triggerAutosave
    );

    expect(command.getDeletedNodeIds()).toEqual(['node-1', 'node-3']);
  });

  it('should restore nodes to correct positions when siblings', () => {
    const command = new DeleteMultipleNodesCommand(
      ['node-1', 'node-3'],
      getState,
      setState,
      mockFindPreviousNode,
      triggerAutosave
    );

    command.execute();
    command.undo();

    const lastCall = setState.mock.calls[setState.mock.calls.length - 1][0];

    // node-1 should be at position 0, node-3 at position 2
    const children = lastCall.nodes['root'].children;
    expect(children.indexOf('node-1')).toBe(0);
    expect(children.indexOf('node-3')).toBe(2);
  });
});
