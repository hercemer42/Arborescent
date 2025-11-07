import { describe, it, expect } from 'vitest';
import { exportNodeWithAncestors } from '../markdownExport';
import { TreeNode, NodeStatus } from '../../../shared/types';

describe('markdownExport', () => {
  describe('exportNodeWithAncestors', () => {
    it('should return empty string for non-existent node', () => {
      const nodes: Record<string, TreeNode> = {};
      const ancestorRegistry: Record<string, string[]> = {};

      const result = exportNodeWithAncestors('non-existent', nodes, ancestorRegistry);

      expect(result).toBe('');
    });

    it('should export single node without ancestors', () => {
      const nodes: Record<string, TreeNode> = {
        'node-1': {
          id: 'node-1',
          content: 'Test Node',
          children: [],
          metadata: {},
        },
      };
      const ancestorRegistry: Record<string, string[]> = {};

      const result = exportNodeWithAncestors('node-1', nodes, ancestorRegistry);

      expect(result).toContain('# Task Context');
      expect(result).toContain('# Test Node');
      expect(result).not.toContain('## Subtasks');
    });

    it('should export node with status', () => {
      const nodes: Record<string, TreeNode> = {
        'node-1': {
          id: 'node-1',
          content: 'Test Node',
          children: [],
          metadata: {
            status: 'in-progress' as NodeStatus,
          },
        },
      };
      const ancestorRegistry: Record<string, string[]> = {};

      const result = exportNodeWithAncestors('node-1', nodes, ancestorRegistry);

      expect(result).toContain('**Status:** in-progress');
    });

    it('should export node with ancestors using correct heading levels', () => {
      const nodes: Record<string, TreeNode> = {
        'root': {
          id: 'root',
          content: 'Root Node',
          children: ['child-1'],
          metadata: {},
        },
        'child-1': {
          id: 'child-1',
          content: 'Child Node',
          children: ['grandchild-1'],
          metadata: {},
        },
        'grandchild-1': {
          id: 'grandchild-1',
          content: 'Grandchild Node',
          children: [],
          metadata: {},
        },
      };
      const ancestorRegistry: Record<string, string[]> = {
        'child-1': ['root'],
        'grandchild-1': ['root', 'child-1'],
      };

      const result = exportNodeWithAncestors('grandchild-1', nodes, ancestorRegistry);

      expect(result).toContain('# Root Node');
      expect(result).toContain('## Child Node');
      expect(result).toContain('### Grandchild Node');
    });

    it('should export node with subtasks', () => {
      const nodes: Record<string, TreeNode> = {
        'parent': {
          id: 'parent',
          content: 'Parent Task',
          children: ['child-1', 'child-2'],
          metadata: {},
        },
        'child-1': {
          id: 'child-1',
          content: 'Subtask 1',
          children: [],
          metadata: {
            status: 'completed' as NodeStatus,
          },
        },
        'child-2': {
          id: 'child-2',
          content: 'Subtask 2',
          children: [],
          metadata: {
            status: 'pending' as NodeStatus,
          },
        },
      };
      const ancestorRegistry: Record<string, string[]> = {};

      const result = exportNodeWithAncestors('parent', nodes, ancestorRegistry);

      expect(result).toContain('## Subtasks');
      expect(result).toContain('Subtask 1');
      expect(result).toContain('Subtask 2');
      expect(result).toContain('✓'); // Completed symbol
      expect(result).toContain('☐'); // Pending symbol
    });

    it('should skip deleted children in subtasks', () => {
      const nodes: Record<string, TreeNode> = {
        'parent': {
          id: 'parent',
          content: 'Parent Task',
          children: ['child-1', 'child-2'],
          metadata: {},
        },
        'child-1': {
          id: 'child-1',
          content: 'Visible Subtask',
          children: [],
          metadata: {},
        },
        'child-2': {
          id: 'child-2',
          content: 'Deleted Subtask',
          children: [],
          metadata: {
            deleted: true,
          },
        },
      };
      const ancestorRegistry: Record<string, string[]> = {};

      const result = exportNodeWithAncestors('parent', nodes, ancestorRegistry);

      expect(result).toContain('Visible Subtask');
      expect(result).not.toContain('Deleted Subtask');
    });

    it('should handle missing child nodes gracefully', () => {
      const nodes: Record<string, TreeNode> = {
        'parent': {
          id: 'parent',
          content: 'Parent Task',
          children: ['child-1', 'missing-child'],
          metadata: {},
        },
        'child-1': {
          id: 'child-1',
          content: 'Existing Child',
          children: [],
          metadata: {},
        },
      };
      const ancestorRegistry: Record<string, string[]> = {};

      const result = exportNodeWithAncestors('parent', nodes, ancestorRegistry);

      expect(result).toContain('Existing Child');
      expect(result).not.toContain('missing-child');
    });

    it('should use default pending status for children without status', () => {
      const nodes: Record<string, TreeNode> = {
        'parent': {
          id: 'parent',
          content: 'Parent Task',
          children: ['child-1'],
          metadata: {},
        },
        'child-1': {
          id: 'child-1',
          content: 'Child Without Status',
          children: [],
          metadata: {},
        },
      };
      const ancestorRegistry: Record<string, string[]> = {};

      const result = exportNodeWithAncestors('parent', nodes, ancestorRegistry);

      expect(result).toContain('☐'); // Pending symbol (default)
    });

    it('should export complex hierarchy', () => {
      const nodes: Record<string, TreeNode> = {
        'root': {
          id: 'root',
          content: 'Project',
          children: ['phase-1'],
          metadata: {
            status: 'pending' as NodeStatus,
          },
        },
        'phase-1': {
          id: 'phase-1',
          content: 'Phase 1',
          children: ['task-1', 'task-2'],
          metadata: {
            status: 'pending' as NodeStatus,
          },
        },
        'task-1': {
          id: 'task-1',
          content: 'Task 1',
          children: [],
          metadata: {
            status: 'completed' as NodeStatus,
          },
        },
        'task-2': {
          id: 'task-2',
          content: 'Task 2',
          children: [],
          metadata: {
            status: 'pending' as NodeStatus,
          },
        },
      };
      const ancestorRegistry: Record<string, string[]> = {
        'phase-1': ['root'],
      };

      const result = exportNodeWithAncestors('phase-1', nodes, ancestorRegistry);

      expect(result).toContain('# Task Context');
      expect(result).toContain('# Project');
      expect(result).toContain('**Status:** pending');
      expect(result).toContain('## Phase 1');
      expect(result).toContain('## Subtasks');
      expect(result).toContain('Task 1');
      expect(result).toContain('Task 2');
    });

    it('should not include subtasks section for node without children', () => {
      const nodes: Record<string, TreeNode> = {
        'leaf': {
          id: 'leaf',
          content: 'Leaf Node',
          children: [],
          metadata: {},
        },
      };
      const ancestorRegistry: Record<string, string[]> = {};

      const result = exportNodeWithAncestors('leaf', nodes, ancestorRegistry);

      expect(result).not.toContain('## Subtasks');
    });

    it('should handle all status types', () => {
      const nodes: Record<string, TreeNode> = {
        'parent': {
          id: 'parent',
          content: 'Parent',
          children: ['child-1', 'child-2', 'child-3'],
          metadata: {},
        },
        'child-1': {
          id: 'child-1',
          content: 'Pending Task',
          children: [],
          metadata: { status: 'pending' as NodeStatus },
        },
        'child-2': {
          id: 'child-2',
          content: 'Completed Task',
          children: [],
          metadata: { status: 'completed' as NodeStatus },
        },
        'child-3': {
          id: 'child-3',
          content: 'Failed Task',
          children: [],
          metadata: { status: 'failed' as NodeStatus },
        },
      };
      const ancestorRegistry: Record<string, string[]> = {};

      const result = exportNodeWithAncestors('parent', nodes, ancestorRegistry);

      expect(result).toContain('☐'); // pending
      expect(result).toContain('✓'); // completed
      expect(result).toContain('✗'); // failed
    });

    it('should format output with proper line breaks', () => {
      const nodes: Record<string, TreeNode> = {
        'node': {
          id: 'node',
          content: 'Test',
          children: ['child'],
          metadata: { status: 'pending' as NodeStatus },
        },
        'child': {
          id: 'child',
          content: 'Child',
          children: [],
          metadata: {},
        },
      };
      const ancestorRegistry: Record<string, string[]> = {};

      const result = exportNodeWithAncestors('node', nodes, ancestorRegistry);

      // Check for proper line breaks
      const lines = result.split('\n');
      expect(lines[0]).toBe('# Task Context');
      expect(lines[1]).toBe('');
      expect(lines[2]).toBe('# Test');
    });

    it('should handle missing ancestors in ancestorRegistry', () => {
      const nodes: Record<string, TreeNode> = {
        'root': {
          id: 'root',
          content: 'Root',
          children: [],
          metadata: {},
        },
        'orphan': {
          id: 'orphan',
          content: 'Orphan Node',
          children: [],
          metadata: {},
        },
      };
      const ancestorRegistry: Record<string, string[]> = {
        'root': [],
      };

      // Node not in ancestorRegistry - should use empty array
      const result = exportNodeWithAncestors('orphan', nodes, ancestorRegistry);

      expect(result).toContain('# Orphan Node');
    });
  });
});
