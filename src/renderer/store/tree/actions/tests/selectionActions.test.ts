import { describe, it, expect, beforeEach } from 'vitest';
import { createSelectionActions } from '../selectionActions';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../../../services/ancestry';

describe('selectionActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    ancestorRegistry: AncestorRegistry;
    multiSelectedNodeIds: Set<string>;
    lastSelectedNodeId: string | null;
    rootNodeId: string;
    summaryModeEnabled: boolean;
    summaryVisibleNodeIds: Set<string> | null;
  };

  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createSelectionActions>;

  beforeEach(() => {
    state = {
      nodes: {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['node-1', 'node-2', 'node-3'],
          metadata: {},
        },
        'node-1': {
          id: 'node-1',
          content: 'Task 1',
          children: ['node-1-1', 'node-1-2'],
          metadata: {},
        },
        'node-1-1': {
          id: 'node-1-1',
          content: 'Task 1.1',
          children: [],
          metadata: {},
        },
        'node-1-2': {
          id: 'node-1-2',
          content: 'Task 1.2',
          children: [],
          metadata: {},
        },
        'node-2': {
          id: 'node-2',
          content: 'Task 2',
          children: [],
          metadata: {},
        },
        'node-3': {
          id: 'node-3',
          content: 'Task 3',
          children: ['node-3-1'],
          metadata: {},
        },
        'node-3-1': {
          id: 'node-3-1',
          content: 'Task 3.1',
          children: [],
          metadata: {},
        },
      },
      ancestorRegistry: {
        'root': [],
        'node-1': ['root'],
        'node-1-1': ['root', 'node-1'],
        'node-1-2': ['root', 'node-1'],
        'node-2': ['root'],
        'node-3': ['root'],
        'node-3-1': ['root', 'node-3'],
      },
      multiSelectedNodeIds: new Set<string>(),
      lastSelectedNodeId: null,
      rootNodeId: 'root',
      summaryModeEnabled: false,
      summaryVisibleNodeIds: null,
    };

    setState = (partial: Partial<TestState>) => {
      state = { ...state, ...partial };
    };

    actions = createSelectionActions(() => state, setState);
  });

  describe('toggleNodeSelection', () => {
    it('should add node to selection with all descendants', () => {
      actions.toggleNodeSelection('node-1');

      expect(state.multiSelectedNodeIds.has('node-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-2')).toBe(true);
      expect(state.lastSelectedNodeId).toBe('node-1');
    });

    it('should update anchor when adding to selection', () => {
      actions.toggleNodeSelection('node-2');

      expect(state.lastSelectedNodeId).toBe('node-2');
    });

    it('should remove node from selection with all descendants', () => {
      // First add to selection
      state.multiSelectedNodeIds = new Set(['node-1', 'node-1-1', 'node-1-2']);
      state.lastSelectedNodeId = 'node-1';

      actions.toggleNodeSelection('node-1');

      expect(state.multiSelectedNodeIds.has('node-1')).toBe(false);
      expect(state.multiSelectedNodeIds.has('node-1-1')).toBe(false);
      expect(state.multiSelectedNodeIds.has('node-1-2')).toBe(false);
      // Anchor is preserved when removing (not set to removed node)
      expect(state.lastSelectedNodeId).toBe('node-1');
    });

    it('should preserve anchor when removing from selection', () => {
      state.multiSelectedNodeIds = new Set(['node-2']);
      state.lastSelectedNodeId = 'node-2';

      actions.toggleNodeSelection('node-2');

      // Anchor stays unchanged (convention: anchor should be a node in selection)
      expect(state.lastSelectedNodeId).toBe('node-2');
    });

    it('should not deselect node when ancestor is selected', () => {
      // Select parent and child
      state.multiSelectedNodeIds = new Set(['node-1', 'node-1-1', 'node-1-2']);
      state.lastSelectedNodeId = 'node-1';

      // Try to deselect child
      actions.toggleNodeSelection('node-1-1');

      // Should remain selected (parent still selected)
      expect(state.multiSelectedNodeIds.has('node-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-2')).toBe(true);
      expect(state.lastSelectedNodeId).toBe('node-1'); // Unchanged
    });

    it('should allow multiple independent selections', () => {
      actions.toggleNodeSelection('node-2');
      actions.toggleNodeSelection('node-3');

      expect(state.multiSelectedNodeIds.has('node-2')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-3')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-3-1')).toBe(true); // Descendant included
    });
  });

  describe('selectRange', () => {
    it('should select single node when no anchor set', () => {
      actions.selectRange('node-2');

      expect(state.multiSelectedNodeIds.has('node-2')).toBe(true);
      expect(state.lastSelectedNodeId).toBe('node-2');
    });

    it('should select range forward from anchor', () => {
      // Set anchor
      state.lastSelectedNodeId = 'node-1';

      // Select range to node-3
      actions.selectRange('node-3');

      // Should select node-1, node-2, node-3 (and their descendants)
      expect(state.multiSelectedNodeIds.has('node-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-2')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-2')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-3')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-3-1')).toBe(true);
      expect(state.lastSelectedNodeId).toBe('node-3');
    });

    it('should select range backward from anchor', () => {
      // Set anchor to node-3
      state.lastSelectedNodeId = 'node-3';

      // Select range back to node-1
      actions.selectRange('node-1');

      // Should select node-1, node-2, node-3 (and descendants)
      expect(state.multiSelectedNodeIds.has('node-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-2')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-2')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-3')).toBe(true);
      expect(state.lastSelectedNodeId).toBe('node-1');
    });

    it('should work after Ctrl+Click sets anchor', () => {
      // Simulate Ctrl+Click on node-1 (sets anchor)
      actions.toggleNodeSelection('node-1');

      expect(state.lastSelectedNodeId).toBe('node-1');

      // Now Shift+Click on node-3
      actions.selectRange('node-3');

      // Should have range from node-1 to node-3
      expect(state.multiSelectedNodeIds.has('node-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-2')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-3')).toBe(true);
    });

    it('should update anchor to clicked node', () => {
      state.lastSelectedNodeId = 'node-1';

      actions.selectRange('node-3');

      expect(state.lastSelectedNodeId).toBe('node-3');
    });

    it('should handle node not found by selecting clicked node', () => {
      state.lastSelectedNodeId = 'invalid-node';

      actions.selectRange('node-2');

      expect(state.multiSelectedNodeIds.has('node-2')).toBe(true);
      expect(state.lastSelectedNodeId).toBe('node-2');
    });

    it('should replace previous selection', () => {
      state.multiSelectedNodeIds = new Set(['node-1']);
      state.lastSelectedNodeId = 'node-1';

      actions.selectRange('node-3');

      // Old selection should be replaced
      expect(state.multiSelectedNodeIds.has('node-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-2')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-3')).toBe(true);
    });
  });

  describe('addToSelection', () => {
    it('should add single node with descendants', () => {
      actions.addToSelection(['node-1']);

      expect(state.multiSelectedNodeIds.has('node-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-2')).toBe(true);
    });

    it('should add multiple nodes with descendants', () => {
      actions.addToSelection(['node-1', 'node-3']);

      expect(state.multiSelectedNodeIds.has('node-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-2')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-3')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-3-1')).toBe(true);
    });

    it('should preserve existing selection', () => {
      state.multiSelectedNodeIds = new Set(['node-2']);

      actions.addToSelection(['node-3']);

      expect(state.multiSelectedNodeIds.has('node-2')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-3')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-3-1')).toBe(true);
    });

    it('should handle empty array', () => {
      state.multiSelectedNodeIds = new Set(['node-2']);

      actions.addToSelection([]);

      expect(state.multiSelectedNodeIds.has('node-2')).toBe(true);
      expect(state.multiSelectedNodeIds.size).toBe(1);
    });
  });

  describe('clearSelection', () => {
    it('should clear all selections', () => {
      state.multiSelectedNodeIds = new Set(['node-1', 'node-2', 'node-3']);
      state.lastSelectedNodeId = 'node-1';

      actions.clearSelection();

      expect(state.multiSelectedNodeIds.size).toBe(0);
      expect(state.lastSelectedNodeId).toBe(null);
    });

    it('should work when selection already empty', () => {
      actions.clearSelection();

      expect(state.multiSelectedNodeIds.size).toBe(0);
      expect(state.lastSelectedNodeId).toBe(null);
    });
  });

  describe('getNodesToMove', () => {
    it('should return empty array when nothing selected', () => {
      const nodes = actions.getNodesToMove();

      expect(nodes).toEqual([]);
    });

    it('should return single node when only one selected', () => {
      state.multiSelectedNodeIds = new Set(['node-2']);

      const nodes = actions.getNodesToMove();

      expect(nodes).toEqual(['node-2']);
    });

    it('should exclude descendants when parent is selected', () => {
      // Select parent and all descendants
      state.multiSelectedNodeIds = new Set(['node-1', 'node-1-1', 'node-1-2']);

      const nodes = actions.getNodesToMove();

      // Should only return parent (descendants will move with it)
      expect(nodes).toEqual(['node-1']);
    });

    it('should include siblings when parent not selected', () => {
      // Select two children of node-1, but not node-1 itself
      state.multiSelectedNodeIds = new Set(['node-1-1', 'node-1-2']);

      const nodes = actions.getNodesToMove();

      // Should return both siblings
      expect(nodes).toContain('node-1-1');
      expect(nodes).toContain('node-1-2');
      expect(nodes).toHaveLength(2);
    });

    it('should filter multiple levels of ancestry', () => {
      // Select root, parent, and child
      state.multiSelectedNodeIds = new Set(['root', 'node-1', 'node-1-1']);

      const nodes = actions.getNodesToMove();

      // Should only return root (all others are descendants)
      expect(nodes).toEqual(['root']);
    });

    it('should return multiple independent branches', () => {
      // Select node-1 with descendants and node-2 (independent)
      state.multiSelectedNodeIds = new Set(['node-1', 'node-1-1', 'node-1-2', 'node-2']);

      const nodes = actions.getNodesToMove();

      // Should return the two independent top-level selections
      expect(nodes).toContain('node-1');
      expect(nodes).toContain('node-2');
      expect(nodes).toHaveLength(2);
    });

    it('should handle mixed selection correctly', () => {
      // Select node-1 (with descendants), node-2, and only node-3-1 (not node-3)
      state.multiSelectedNodeIds = new Set(['node-1', 'node-1-1', 'node-1-2', 'node-2', 'node-3-1']);

      const nodes = actions.getNodesToMove();

      // Should return: node-1, node-2, node-3-1
      // (node-1-1 and node-1-2 excluded because parent selected)
      expect(nodes).toContain('node-1');
      expect(nodes).toContain('node-2');
      expect(nodes).toContain('node-3-1');
      expect(nodes).toHaveLength(3);
    });
  });

  describe('summary mode filtering', () => {
    it('should only select visible nodes in summary mode', () => {
      // Enable summary mode with only some nodes visible
      state.summaryModeEnabled = true;
      state.summaryVisibleNodeIds = new Set(['node-1', 'node-1-1', 'node-2']);
      // node-1-2 is NOT visible

      actions.toggleNodeSelection('node-1');

      // Should include node-1 and node-1-1 (visible descendants)
      expect(state.multiSelectedNodeIds.has('node-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-1')).toBe(true);
      // Should NOT include node-1-2 (not visible in summary mode)
      expect(state.multiSelectedNodeIds.has('node-1-2')).toBe(false);
    });

    it('should not select invisible node in summary mode', () => {
      state.summaryModeEnabled = true;
      state.summaryVisibleNodeIds = new Set(['node-1', 'node-2']);
      // node-1-1 is NOT visible

      actions.toggleNodeSelection('node-1-1');

      // Should not add invisible node to selection
      expect(state.multiSelectedNodeIds.has('node-1-1')).toBe(false);
      expect(state.multiSelectedNodeIds.size).toBe(0);
    });

    it('should select all descendants when summary mode disabled', () => {
      state.summaryModeEnabled = false;
      state.summaryVisibleNodeIds = null;

      actions.toggleNodeSelection('node-1');

      // All descendants should be selected
      expect(state.multiSelectedNodeIds.has('node-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-2')).toBe(true);
    });

    it('should only add visible nodes in summary mode via addToSelection', () => {
      state.summaryModeEnabled = true;
      state.summaryVisibleNodeIds = new Set(['node-1', 'node-3', 'node-3-1']);
      // node-1-1, node-1-2, node-2 are NOT visible

      actions.addToSelection(['node-1', 'node-3']);

      expect(state.multiSelectedNodeIds.has('node-1')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-1-1')).toBe(false);
      expect(state.multiSelectedNodeIds.has('node-1-2')).toBe(false);
      expect(state.multiSelectedNodeIds.has('node-3')).toBe(true);
      expect(state.multiSelectedNodeIds.has('node-3-1')).toBe(true);
    });
  });
});
