import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ContentEditCommand } from '../ContentEditCommand';
import { TreeNode } from '../../../../../shared/types';

describe('ContentEditCommand', () => {
  let nodes: Record<string, TreeNode>;
  let getNodes: () => Record<string, TreeNode>;
  let setNodes: ReturnType<typeof vi.fn>;
  let selectNode: ReturnType<typeof vi.fn>;
  let triggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    nodes = {
      'node1': {
        id: 'node1',
        content: 'initial content',
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
    it('should update node content', () => {
      const cmd = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        'initial content',
        'new content',
        selectNode,
        triggerAutosave
      );

      cmd.execute();

      expect(setNodes).toHaveBeenCalledWith({
        node1: {
          id: 'node1',
          content: 'new content',
          children: [],
          metadata: {},
        },
      });
      expect(triggerAutosave).toHaveBeenCalled();
    });

    it('should not set cursor during execute', () => {
      const cmd = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        'initial content',
        'new content',
        selectNode,
        triggerAutosave
      );

      cmd.execute();

      expect(selectNode).not.toHaveBeenCalled();
    });
  });

  describe('undo', () => {
    it('should restore old content', () => {
      const cmd = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        'initial content',
        'new content',
        selectNode,
        triggerAutosave
      );

      cmd.execute();
      cmd.undo();

      expect(setNodes).toHaveBeenCalledWith({
        node1: {
          id: 'node1',
          content: 'initial content',
          children: [],
          metadata: {},
        },
      });
    });

    it('should select node and set cursor at end of old content', () => {
      const cmd = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        'hello',
        'hello world',
        selectNode,
        triggerAutosave
      );

      cmd.execute();
      cmd.undo();

      expect(selectNode).toHaveBeenCalledWith('node1', 5); // End of "hello"
    });
  });

  describe('redo', () => {
    it('should restore new content', () => {
      const cmd = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        'initial content',
        'new content',
        selectNode,
        triggerAutosave
      );

      cmd.execute();
      cmd.undo();
      cmd.redo();

      expect(setNodes).toHaveBeenCalledWith({
        node1: {
          id: 'node1',
          content: 'new content',
          children: [],
          metadata: {},
        },
      });
    });

    it('should select node and set cursor at end of new content', () => {
      const cmd = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        'hello',
        'hello world',
        selectNode,
        triggerAutosave
      );

      cmd.execute();
      cmd.undo();
      selectNode.mockClear();
      cmd.redo();

      expect(selectNode).toHaveBeenCalledWith('node1', 11); // End of "hello world"
    });
  });

  describe('canMergeWith', () => {
    it('should not merge with non-ContentEditCommand', () => {
      const cmd1 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        '',
        'hello',
        selectNode,
        triggerAutosave
      );

      expect(cmd1.canMergeWith({})).toBe(false);
      expect(cmd1.canMergeWith(null)).toBe(false);
    });

    it('should not merge edits to different nodes', () => {
      const cmd1 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        '',
        'hello',
        selectNode,
        triggerAutosave
      );

      const cmd2 = new ContentEditCommand(
        'node2',
        getNodes,
        setNodes,
        '',
        'world',
        selectNode,
        triggerAutosave
      );

      expect(cmd1.canMergeWith(cmd2)).toBe(false);
    });

    it('should not merge non-contiguous edits', () => {
      const cmd1 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        '',
        'hello',
        selectNode,
        triggerAutosave
      );

      const cmd2 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        'different',
        'hello world',
        selectNode,
        triggerAutosave
      );

      expect(cmd1.canMergeWith(cmd2)).toBe(false);
    });

    it('should merge contiguous character additions', () => {
      const cmd1 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        '',
        'hello',
        selectNode,
        triggerAutosave
      );

      const cmd2 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        'hello',
        'hellow',
        selectNode,
        triggerAutosave
      );

      expect(cmd1.canMergeWith(cmd2)).toBe(true);
    });

    it('should NOT merge when space is added', () => {
      const cmd1 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        '',
        'hello',
        selectNode,
        triggerAutosave
      );

      const cmd2 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        'hello',
        'hello ',
        selectNode,
        triggerAutosave
      );

      expect(cmd1.canMergeWith(cmd2)).toBe(false);
    });

    it('should NOT merge when non-breaking space (nbsp) is added', () => {
      const cmd1 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        '',
        'hello',
        selectNode,
        triggerAutosave
      );

      const cmd2 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        'hello',
        'hello\u00A0', // nbsp (char 160)
        selectNode,
        triggerAutosave
      );

      expect(cmd1.canMergeWith(cmd2)).toBe(false);
    });

    it('should NOT merge when space is removed', () => {
      const cmd1 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        '',
        'hello world',
        selectNode,
        triggerAutosave
      );

      const cmd2 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        'hello world',
        'hello',
        selectNode,
        triggerAutosave
      );

      expect(cmd1.canMergeWith(cmd2)).toBe(false);
    });

    it('should merge character deletions (backspace)', () => {
      const cmd1 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        '',
        'hello',
        selectNode,
        triggerAutosave
      );

      const cmd2 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        'hello',
        'hell',
        selectNode,
        triggerAutosave
      );

      expect(cmd1.canMergeWith(cmd2)).toBe(true);
    });
  });

  describe('mergeWith', () => {
    it('should update new content when merging', () => {
      const cmd1 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        '',
        'hello',
        selectNode,
        triggerAutosave
      );

      const cmd2 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        'hello',
        'hellow',
        selectNode,
        triggerAutosave
      );

      cmd1.mergeWith(cmd2);

      // Execute the merged command
      cmd1.execute();

      expect(setNodes).toHaveBeenCalledWith({
        node1: {
          id: 'node1',
          content: 'hellow', // Final merged content
          children: [],
          metadata: {},
        },
      });
    });

    it('should preserve old content from first command', () => {
      const cmd1 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        'initial',
        'hello',
        selectNode,
        triggerAutosave
      );

      const cmd2 = new ContentEditCommand(
        'node1',
        getNodes,
        setNodes,
        'hello',
        'hellow',
        selectNode,
        triggerAutosave
      );

      cmd1.mergeWith(cmd2);
      cmd1.execute();
      cmd1.undo();

      expect(setNodes).toHaveBeenCalledWith({
        node1: {
          id: 'node1',
          content: 'initial', // Original old content
          children: [],
          metadata: {},
        },
      });
    });
  });
});
