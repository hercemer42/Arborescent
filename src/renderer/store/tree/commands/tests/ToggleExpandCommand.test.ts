import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToggleExpandCommand } from '../ToggleExpandCommand';
import { TreeNode } from '../../../../../shared/types';

describe('ToggleExpandCommand', () => {
  let nodes: Record<string, TreeNode>;
  let getNodes: () => Record<string, TreeNode>;
  let setNodes: ReturnType<typeof vi.fn>;
  let selectNode: ReturnType<typeof vi.fn>;
  let triggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nodes = {
      node1: {
        id: 'node1',
        content: 'Parent node',
        children: ['child1', 'child2'],
        metadata: { expanded: true },
      },
      child1: {
        id: 'child1',
        content: 'Child 1',
        children: [],
        metadata: {},
      },
      child2: {
        id: 'child2',
        content: 'Child 2',
        children: [],
        metadata: {},
      },
    };

    getNodes = () => nodes;
    setNodes = vi.fn((updatedNodes) => {
      nodes = updatedNodes;
    });
    selectNode = vi.fn();
    triggerAutosave = vi.fn();
  });

  describe('execute', () => {
    it('should collapse an expanded node', () => {
      const cmd = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      cmd.execute();

      expect(setNodes).toHaveBeenCalledWith({
        node1: {
          id: 'node1',
          content: 'Parent node',
          children: ['child1', 'child2'],
          metadata: { expanded: false },
        },
        child1: nodes.child1,
        child2: nodes.child2,
      });
    });

    it('should expand a collapsed node', () => {
      nodes.node1.metadata.expanded = false;

      const cmd = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      cmd.execute();

      expect(setNodes).toHaveBeenCalledWith({
        node1: {
          id: 'node1',
          content: 'Parent node',
          children: ['child1', 'child2'],
          metadata: { expanded: true },
        },
        child1: nodes.child1,
        child2: nodes.child2,
      });
    });

    it('should collapse node when expanded is undefined (defaults to true)', () => {
      delete nodes.node1.metadata.expanded;

      const cmd = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      cmd.execute();

      expect(setNodes).toHaveBeenCalledWith({
        node1: {
          id: 'node1',
          content: 'Parent node',
          children: ['child1', 'child2'],
          metadata: { expanded: false },
        },
        child1: nodes.child1,
        child2: nodes.child2,
      });
    });

    it('should not toggle if node has no children', () => {
      const cmd = new ToggleExpandCommand(
        'child1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      cmd.execute();

      expect(setNodes).not.toHaveBeenCalled();
    });

    it('should trigger autosave if provided', () => {
      const cmd = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      cmd.execute();

      expect(triggerAutosave).toHaveBeenCalled();
    });

    it('should not trigger autosave if not provided', () => {
      const cmd = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        undefined
      );

      cmd.execute();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should not select node during execute', () => {
      const cmd = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      cmd.execute();

      expect(selectNode).not.toHaveBeenCalled();
    });
  });

  describe('undo', () => {
    it('should restore old expanded state', () => {
      nodes.node1.metadata.expanded = true;

      const cmd = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      cmd.execute(); // Collapses to false
      setNodes.mockClear();
      cmd.undo(); // Should restore to true

      expect(setNodes).toHaveBeenCalledWith({
        node1: {
          id: 'node1',
          content: 'Parent node',
          children: ['child1', 'child2'],
          metadata: { expanded: true },
        },
        child1: nodes.child1,
        child2: nodes.child2,
      });
    });

    it('should select node and place cursor at end', () => {
      const cmd = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      cmd.execute();
      selectNode.mockClear();
      cmd.undo();

      expect(selectNode).toHaveBeenCalledWith('node1', 11); // Length of "Parent node"
    });

    it('should trigger autosave on undo', () => {
      const cmd = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      cmd.execute();
      triggerAutosave.mockClear();
      cmd.undo();

      expect(triggerAutosave).toHaveBeenCalled();
    });
  });

  describe('redo', () => {
    it('should restore new expanded state', () => {
      nodes.node1.metadata.expanded = true;

      const cmd = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      cmd.execute(); // Collapses to false
      cmd.undo();    // Restores to true
      setNodes.mockClear();
      cmd.redo();    // Should collapse to false again

      expect(setNodes).toHaveBeenCalledWith({
        node1: {
          id: 'node1',
          content: 'Parent node',
          children: ['child1', 'child2'],
          metadata: { expanded: false },
        },
        child1: nodes.child1,
        child2: nodes.child2,
      });
    });

    it('should select node and place cursor at end', () => {
      const cmd = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      cmd.execute();
      cmd.undo();
      selectNode.mockClear();
      cmd.redo();

      expect(selectNode).toHaveBeenCalledWith('node1', 11); // Length of "Parent node"
    });

    it('should handle complete toggle cycle', () => {
      nodes.node1.metadata.expanded = true;

      const cmd1 = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      const cmd2 = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      // true -> false
      cmd1.execute();
      expect(nodes.node1.metadata.expanded).toBe(false);

      // false -> true
      cmd2.execute();
      expect(nodes.node1.metadata.expanded).toBe(true);
    });
  });

  describe('canMergeWith', () => {
    it('should never merge with any command', () => {
      const cmd1 = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      const cmd2 = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      expect(cmd1.canMergeWith(cmd2)).toBe(false);
    });

    it('should not merge with other command types', () => {
      const cmd = new ToggleExpandCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      expect(cmd.canMergeWith({ some: 'object' })).toBe(false);
      expect(cmd.canMergeWith(null)).toBe(false);
      expect(cmd.canMergeWith(undefined)).toBe(false);
    });
  });
});
