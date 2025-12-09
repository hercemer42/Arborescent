import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SetStatusBatchCommand } from '../SetStatusBatchCommand';
import { TreeNode } from '../../../../../shared/types';

describe('SetStatusBatchCommand', () => {
  let nodes: Record<string, TreeNode>;
  let getNodes: () => Record<string, TreeNode>;
  let setNodes: ReturnType<typeof vi.fn>;
  let triggerAutosave: ReturnType<typeof vi.fn>;
  let onStatusChange: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nodes = {
      parent: {
        id: 'parent',
        content: 'Parent node',
        children: ['child1', 'child2'],
        metadata: { status: 'pending' },
      },
      child1: {
        id: 'child1',
        content: 'Child 1',
        children: ['grandchild'],
        metadata: { status: 'pending' },
      },
      child2: {
        id: 'child2',
        content: 'Child 2',
        children: [],
        metadata: { status: 'completed', resolvedAt: '2024-01-01T00:00:00.000Z' },
      },
      grandchild: {
        id: 'grandchild',
        content: 'Grandchild',
        children: [],
        metadata: { status: 'abandoned' },
      },
    };

    getNodes = () => nodes;
    setNodes = vi.fn((updatedNodes) => {
      nodes = updatedNodes;
    });
    triggerAutosave = vi.fn();
    onStatusChange = vi.fn();
  });

  describe('execute - mark all as complete', () => {
    it('should mark node and all descendants as completed', () => {
      const cmd = new SetStatusBatchCommand(
        'parent',
        'completed',
        getNodes,
        setNodes,
        triggerAutosave,
        onStatusChange
      );

      cmd.execute();

      expect(setNodes).toHaveBeenCalled();
      const updatedNodes = setNodes.mock.calls[0][0];
      expect(updatedNodes.parent.metadata.status).toBe('completed');
      expect(updatedNodes.child1.metadata.status).toBe('completed');
      expect(updatedNodes.child2.metadata.status).toBe('completed');
      expect(updatedNodes.grandchild.metadata.status).toBe('completed');
    });

    it('should set resolvedAt for all affected nodes', () => {
      const cmd = new SetStatusBatchCommand(
        'parent',
        'completed',
        getNodes,
        setNodes,
        triggerAutosave,
        onStatusChange
      );

      cmd.execute();

      const updatedNodes = setNodes.mock.calls[0][0];
      expect(updatedNodes.parent.metadata.resolvedAt).toBeDefined();
      expect(updatedNodes.child1.metadata.resolvedAt).toBeDefined();
      expect(updatedNodes.child2.metadata.resolvedAt).toBeDefined();
      expect(updatedNodes.grandchild.metadata.resolvedAt).toBeDefined();
    });

    it('should trigger autosave and status change callback', () => {
      const cmd = new SetStatusBatchCommand(
        'parent',
        'completed',
        getNodes,
        setNodes,
        triggerAutosave,
        onStatusChange
      );

      cmd.execute();

      expect(triggerAutosave).toHaveBeenCalled();
      expect(onStatusChange).toHaveBeenCalled();
    });
  });

  describe('execute - mark all as incomplete (pending)', () => {
    it('should mark node and all descendants as pending', () => {
      // Start with all completed
      nodes.parent.metadata.status = 'completed';
      nodes.child1.metadata.status = 'completed';
      nodes.child2.metadata.status = 'completed';
      nodes.grandchild.metadata.status = 'completed';

      const cmd = new SetStatusBatchCommand(
        'parent',
        'pending',
        getNodes,
        setNodes,
        triggerAutosave,
        onStatusChange
      );

      cmd.execute();

      expect(setNodes).toHaveBeenCalled();
      const updatedNodes = setNodes.mock.calls[0][0];
      expect(updatedNodes.parent.metadata.status).toBe('pending');
      expect(updatedNodes.child1.metadata.status).toBe('pending');
      expect(updatedNodes.child2.metadata.status).toBe('pending');
      expect(updatedNodes.grandchild.metadata.status).toBe('pending');
    });

    it('should clear resolvedAt for all affected nodes', () => {
      // Start with resolvedAt set
      nodes.parent.metadata.resolvedAt = '2024-01-01T00:00:00.000Z';
      nodes.child1.metadata.resolvedAt = '2024-01-01T00:00:00.000Z';

      const cmd = new SetStatusBatchCommand(
        'parent',
        'pending',
        getNodes,
        setNodes,
        triggerAutosave,
        onStatusChange
      );

      cmd.execute();

      const updatedNodes = setNodes.mock.calls[0][0];
      expect(updatedNodes.parent.metadata.resolvedAt).toBeUndefined();
      expect(updatedNodes.child1.metadata.resolvedAt).toBeUndefined();
      expect(updatedNodes.grandchild.metadata.resolvedAt).toBeUndefined();
    });
  });

  describe('execute - single node (no children)', () => {
    it('should only mark the single node', () => {
      const cmd = new SetStatusBatchCommand(
        'grandchild',
        'completed',
        getNodes,
        setNodes,
        triggerAutosave,
        onStatusChange
      );

      cmd.execute();

      const updatedNodes = setNodes.mock.calls[0][0];
      expect(updatedNodes.grandchild.metadata.status).toBe('completed');
      // Parent nodes should not be affected
      expect(updatedNodes.parent.metadata.status).toBe('pending');
      expect(updatedNodes.child1.metadata.status).toBe('pending');
    });
  });

  describe('undo', () => {
    it('should restore all previous statuses', () => {
      const cmd = new SetStatusBatchCommand(
        'parent',
        'completed',
        getNodes,
        setNodes,
        triggerAutosave,
        onStatusChange
      );

      cmd.execute();
      setNodes.mockClear();
      triggerAutosave.mockClear();
      onStatusChange.mockClear();
      cmd.undo();

      expect(setNodes).toHaveBeenCalled();
      const updatedNodes = setNodes.mock.calls[0][0];
      expect(updatedNodes.parent.metadata.status).toBe('pending');
      expect(updatedNodes.child1.metadata.status).toBe('pending');
      expect(updatedNodes.child2.metadata.status).toBe('completed');
      expect(updatedNodes.grandchild.metadata.status).toBe('abandoned');
    });

    it('should restore resolvedAt values', () => {
      const originalResolvedAt = nodes.child2.metadata.resolvedAt;

      const cmd = new SetStatusBatchCommand(
        'parent',
        'completed',
        getNodes,
        setNodes,
        triggerAutosave,
        onStatusChange
      );

      cmd.execute();
      cmd.undo();

      const updatedNodes = setNodes.mock.calls[1][0];
      expect(updatedNodes.parent.metadata.resolvedAt).toBeUndefined();
      expect(updatedNodes.child2.metadata.resolvedAt).toBe(originalResolvedAt);
    });

    it('should trigger autosave and status change callback', () => {
      const cmd = new SetStatusBatchCommand(
        'parent',
        'completed',
        getNodes,
        setNodes,
        triggerAutosave,
        onStatusChange
      );

      cmd.execute();
      triggerAutosave.mockClear();
      onStatusChange.mockClear();
      cmd.undo();

      expect(triggerAutosave).toHaveBeenCalled();
      expect(onStatusChange).toHaveBeenCalled();
    });
  });

  describe('redo', () => {
    it('should re-apply the status change', () => {
      const cmd = new SetStatusBatchCommand(
        'parent',
        'completed',
        getNodes,
        setNodes,
        triggerAutosave,
        onStatusChange
      );

      cmd.execute();
      cmd.undo();
      setNodes.mockClear();
      cmd.redo();

      expect(setNodes).toHaveBeenCalled();
      const updatedNodes = setNodes.mock.calls[0][0];
      expect(updatedNodes.parent.metadata.status).toBe('completed');
      expect(updatedNodes.child1.metadata.status).toBe('completed');
      expect(updatedNodes.child2.metadata.status).toBe('completed');
      expect(updatedNodes.grandchild.metadata.status).toBe('completed');
    });
  });

  describe('edge cases', () => {
    it('should handle non-existent node gracefully', () => {
      const cmd = new SetStatusBatchCommand(
        'nonexistent',
        'completed',
        getNodes,
        setNodes,
        triggerAutosave,
        onStatusChange
      );

      cmd.execute();

      expect(setNodes).not.toHaveBeenCalled();
    });

    it('should handle node with undefined metadata', () => {
      nodes.parent.metadata = {};

      const cmd = new SetStatusBatchCommand(
        'parent',
        'completed',
        getNodes,
        setNodes,
        triggerAutosave,
        onStatusChange
      );

      cmd.execute();

      const updatedNodes = setNodes.mock.calls[0][0];
      expect(updatedNodes.parent.metadata.status).toBe('completed');
    });
  });
});
