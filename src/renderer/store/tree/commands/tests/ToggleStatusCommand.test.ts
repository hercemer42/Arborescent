import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ToggleStatusCommand } from '../ToggleStatusCommand';
import { TreeNode } from '../../../../../shared/types';

describe('ToggleStatusCommand', () => {
  let nodes: Record<string, TreeNode>;
  let getNodes: () => Record<string, TreeNode>;
  let setNodes: ReturnType<typeof vi.fn>;
  let selectNode: ReturnType<typeof vi.fn>;
  let triggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nodes = {
      node1: {
        id: 'node1',
        content: 'Test node',
        children: [],
        metadata: { status: 'pending' },
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
    it('should toggle from pending to completed', () => {
      const cmd = new ToggleStatusCommand(
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
          content: 'Test node',
          children: [],
          metadata: { status: 'completed' },
        },
      });
    });

    it('should toggle from completed to failed', () => {
      nodes.node1.metadata.status = 'completed';

      const cmd = new ToggleStatusCommand(
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
          content: 'Test node',
          children: [],
          metadata: { status: 'abandoned' },
        },
      });
    });

    it('should toggle from failed to pending', () => {
      nodes.node1.metadata.status = 'abandoned';

      const cmd = new ToggleStatusCommand(
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
          content: 'Test node',
          children: [],
          metadata: { status: 'pending' },
        },
      });
    });

    it('should handle node without status (treat as pending)', () => {
      nodes.node1.metadata = {};

      const cmd = new ToggleStatusCommand(
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
          content: 'Test node',
          children: [],
          metadata: { status: 'completed' },
        },
      });
    });

    it('should trigger autosave', () => {
      const cmd = new ToggleStatusCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      cmd.execute();

      expect(triggerAutosave).toHaveBeenCalled();
    });

    it('should not select node during execute', () => {
      const cmd = new ToggleStatusCommand(
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
    it('should restore old status', () => {
      const cmd = new ToggleStatusCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      cmd.execute();
      setNodes.mockClear();
      cmd.undo();

      expect(setNodes).toHaveBeenCalledWith({
        node1: {
          id: 'node1',
          content: 'Test node',
          children: [],
          metadata: { status: 'pending' },
        },
      });
    });

    it('should select node and place cursor at end', () => {
      const cmd = new ToggleStatusCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      cmd.execute();
      selectNode.mockClear();
      cmd.undo();

      expect(selectNode).toHaveBeenCalledWith('node1', 9); // Length of "Test node"
    });

    it('should trigger autosave on undo', () => {
      const cmd = new ToggleStatusCommand(
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
    it('should restore new status', () => {
      const cmd = new ToggleStatusCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      cmd.execute();
      cmd.undo();
      setNodes.mockClear();
      cmd.redo();

      expect(setNodes).toHaveBeenCalledWith({
        node1: {
          id: 'node1',
          content: 'Test node',
          children: [],
          metadata: { status: 'completed' },
        },
      });
    });

    it('should select node and place cursor at end', () => {
      const cmd = new ToggleStatusCommand(
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

      expect(selectNode).toHaveBeenCalledWith('node1', 9); // Length of "Test node"
    });

    it('should handle complete toggle cycle', () => {
      const cmd1 = new ToggleStatusCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      const cmd2 = new ToggleStatusCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      const cmd3 = new ToggleStatusCommand(
        'node1',
        getNodes,
        setNodes,
        selectNode,
        triggerAutosave
      );

      // pending -> completed
      cmd1.execute();
      expect(nodes.node1.metadata.status).toBe('completed');

      // completed -> failed
      cmd2.execute();
      expect(nodes.node1.metadata.status).toBe('abandoned');

      // failed -> pending
      cmd3.execute();
      expect(nodes.node1.metadata.status).toBe('pending');
    });
  });
});
