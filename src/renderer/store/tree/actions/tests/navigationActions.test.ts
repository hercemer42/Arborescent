import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNavigationActions } from '../navigationActions';
import type { TreeNode } from '@shared/types';

describe('navigationActions', () => {
  let state: { nodes: Record<string, TreeNode>; rootNodeId: string; ancestorRegistry: Record<string, string[]>; activeNodeId: string | null; cursorPosition: number; rememberedVisualX: number | null; actions?: { executeCommand?: (cmd: unknown) => void } };
  let setState: (partial: Partial<typeof state>) => void;
  let actions: ReturnType<typeof createNavigationActions>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockExecuteCommand = vi.fn((command: { execute: () => void }) => {
      // Execute the command immediately in tests
      command.execute();
    });

    state = {
      nodes: {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['child-1', 'child-2'],
          metadata: {},
        },
        'child-1': {
          id: 'child-1',
          content: 'Child 1',
          children: ['grandchild-1'],
          metadata: {},
        },
        'grandchild-1': {
          id: 'grandchild-1',
          content: 'Grandchild 1',
          children: [],
          metadata: {},
        },
        'child-2': {
          id: 'child-2',
          content: 'Child 2',
          children: [],
          metadata: {},
        },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'child-1': ['root'],
        'child-2': ['root'],
        'grandchild-1': ['root', 'child-1'],
      },
      activeNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      actions: { executeCommand: mockExecuteCommand },
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    actions = createNavigationActions(
      () => state,
      setState
    );
  });

  describe('moveUp', () => {
    it('should move selection up in flat list', () => {
      state.activeNodeId = 'grandchild-1';
      actions.moveUp();
      expect(state.activeNodeId).toBe('child-1');
    });

    it('should not move up from first node', () => {
      state.activeNodeId = 'root';
      actions.moveUp();
      expect(state.activeNodeId).toBe('root');
    });

    it('should handle moving up from nested nodes', () => {
      state.activeNodeId = 'grandchild-1';
      actions.moveUp();
      expect(state.activeNodeId).toBe('child-1');
    });
  });

  describe('moveDown', () => {
    it('should move selection down in flat list', () => {
      state.activeNodeId = 'root';
      actions.moveDown();
      expect(state.activeNodeId).toBe('child-1');
    });

    it('should not move down from last node', () => {
      state.activeNodeId = 'child-2';
      actions.moveDown();
      expect(state.activeNodeId).toBe('child-2');
    });

    it('should handle moving down through nested nodes', () => {
      state.activeNodeId = 'child-1';
      actions.moveDown();
      expect(state.activeNodeId).toBe('grandchild-1');
    });

    it('should select first node when nothing selected', () => {
      state.activeNodeId = null;
      actions.moveDown();
      expect(state.activeNodeId).toBe('child-1');
    });
  });

  describe('moveBack', () => {
    it('should move to previous node with cursor at end', () => {
      state.activeNodeId = 'grandchild-1';
      actions.moveBack();
      expect(state.activeNodeId).toBe('child-1');
      expect(state.cursorPosition).toBe(7);
      expect(state.rememberedVisualX).toBeNull();
    });

    it('should not move from first node', () => {
      state.activeNodeId = 'root';
      actions.moveBack();
      expect(state.activeNodeId).toBe('root');
    });

    it('should handle moving from nested nodes', () => {
      state.activeNodeId = 'grandchild-1';
      actions.moveBack();
      expect(state.activeNodeId).toBe('child-1');
      expect(state.cursorPosition).toBe(7);
    });

    it('should clear remembered visual X position', () => {
      state.activeNodeId = 'grandchild-1';
      state.rememberedVisualX = 10;
      actions.moveBack();
      expect(state.rememberedVisualX).toBeNull();
    });
  });

  describe('moveForward', () => {
    it('should move to next node with cursor at start', () => {
      state.activeNodeId = 'root';
      actions.moveForward();
      expect(state.activeNodeId).toBe('child-1');
      expect(state.cursorPosition).toBe(0);
      expect(state.rememberedVisualX).toBeNull();
    });

    it('should not move from last node', () => {
      state.activeNodeId = 'child-2';
      actions.moveForward();
      expect(state.activeNodeId).toBe('child-2');
    });

    it('should handle moving through nested nodes', () => {
      state.activeNodeId = 'child-1';
      actions.moveForward();
      expect(state.activeNodeId).toBe('grandchild-1');
      expect(state.cursorPosition).toBe(0);
    });

    it('should clear remembered visual X position', () => {
      state.activeNodeId = 'root';
      state.rememberedVisualX = 10;
      actions.moveForward();
      expect(state.rememberedVisualX).toBeNull();
    });
  });

  describe('toggleNode', () => {
    it('should collapse an expanded node', () => {
      state.nodes['child-1'].metadata.expanded = true;
      actions.toggleNode('child-1');
      expect(state.nodes['child-1'].metadata.expanded).toBe(false);
    });

    it('should expand a collapsed node', () => {
      state.nodes['child-1'].metadata.expanded = false;
      actions.toggleNode('child-1');
      expect(state.nodes['child-1'].metadata.expanded).toBe(true);
    });

    it('should collapse node when expanded is undefined (defaults to true)', () => {
      delete state.nodes['child-1'].metadata.expanded;
      actions.toggleNode('child-1');
      expect(state.nodes['child-1'].metadata.expanded).toBe(false);
    });

    it('should not modify state if node does not exist', () => {
      const nodesBefore = state.nodes;
      actions.toggleNode('non-existent');
      expect(state.nodes).toBe(nodesBefore);
    });

    it('should preserve other metadata when toggling', () => {
      state.nodes['child-1'].metadata = { status: 'completed', expanded: true, created: '2025-01-01' };
      actions.toggleNode('child-1');
      expect(state.nodes['child-1'].metadata).toEqual({
        status: 'completed',
        expanded: false,
        created: '2025-01-01',
      });
    });

    it('should not toggle nodes without children', () => {
      // Create a node with no children
      state.nodes['leaf'] = {
        id: 'leaf',
        content: 'Leaf node',
        children: [],
        metadata: { expanded: true },
      };

      const expandedBefore = state.nodes['leaf'].metadata.expanded;
      actions.toggleNode('leaf');
      expect(state.nodes['leaf'].metadata.expanded).toBe(expandedBefore);
    });
  });

  describe('zoom-boundary navigation', () => {
    beforeEach(() => {
      state.nodes['zoom-root'] = {
        id: 'zoom-root',
        content: 'Zoomed Root',
        children: ['zoom-child-1', 'zoom-child-2'],
        metadata: {},
      };
      state.nodes['zoom-child-1'] = {
        id: 'zoom-child-1',
        content: 'Zoom Child 1',
        children: [],
        metadata: {},
      };
      state.nodes['zoom-child-2'] = {
        id: 'zoom-child-2',
        content: 'Zoom Child 2',
        children: [],
        metadata: {},
      };
      state.nodes['outside-sibling'] = {
        id: 'outside-sibling',
        content: 'Outside',
        children: [],
        metadata: {},
      };
      state.nodes['root'].children = ['zoom-root', 'outside-sibling'];
      state.ancestorRegistry = {
        'root': [],
        'zoom-root': ['root'],
        'zoom-child-1': ['root', 'zoom-root'],
        'zoom-child-2': ['root', 'zoom-root'],
        'outside-sibling': ['root'],
      };
    });

    it('should stop moveUp at first child of boundary instead of crossing to the zoomed node', () => {
      state.activeNodeId = 'zoom-child-1';
      actions.moveUp(undefined, undefined, 'zoom-root');
      expect(state.activeNodeId).toBe('zoom-child-1');
    });

    it('should navigate moveUp within the boundary subtree normally', () => {
      state.activeNodeId = 'zoom-child-2';
      actions.moveUp(undefined, undefined, 'zoom-root');
      expect(state.activeNodeId).toBe('zoom-child-1');
    });

    it('should stop moveDown at last descendant of boundary instead of crossing to outside sibling', () => {
      state.activeNodeId = 'zoom-child-2';
      actions.moveDown(undefined, undefined, 'zoom-root');
      expect(state.activeNodeId).toBe('zoom-child-2');
    });

    it('should navigate moveDown within the boundary subtree normally', () => {
      state.activeNodeId = 'zoom-child-1';
      actions.moveDown(undefined, undefined, 'zoom-root');
      expect(state.activeNodeId).toBe('zoom-child-2');
    });

    it('should stop moveBack at first child of boundary', () => {
      state.activeNodeId = 'zoom-child-1';
      actions.moveBack('zoom-root');
      expect(state.activeNodeId).toBe('zoom-child-1');
    });

    it('should stop moveForward at last descendant of boundary', () => {
      state.activeNodeId = 'zoom-child-2';
      actions.moveForward('zoom-root');
      expect(state.activeNodeId).toBe('zoom-child-2');
    });

    it('should keep existing moveUp behavior when no boundary is passed', () => {
      state.activeNodeId = 'zoom-child-1';
      actions.moveUp();
      expect(state.activeNodeId).toBe('zoom-root');
    });

    it('should use boundary children as entry point for moveDown when activeNodeId is null', () => {
      state.activeNodeId = null;
      actions.moveDown(undefined, undefined, 'zoom-root');
      expect(state.activeNodeId).toBe('zoom-child-1');
    });
  });

  describe('navigation with collapsed nodes', () => {
    beforeEach(() => {
      state.nodes['child-1'].metadata.expanded = false;
    });

    it('should skip collapsed children when moving down', () => {
      state.activeNodeId = 'child-1';
      actions.moveDown();
      expect(state.activeNodeId).toBe('child-2');
    });

    it('should skip collapsed children when moving up', () => {
      state.activeNodeId = 'child-2';
      actions.moveUp();
      expect(state.activeNodeId).toBe('child-1');
    });

    it('should skip collapsed children when moving to next', () => {
      state.activeNodeId = 'child-1';
      actions.moveForward();
      expect(state.activeNodeId).toBe('child-2');
    });

    it('should skip collapsed children when moving to previous', () => {
      state.activeNodeId = 'child-2';
      actions.moveBack();
      expect(state.activeNodeId).toBe('child-1');
      expect(state.cursorPosition).toBe(7);
    });

    it('should include children when node is expanded', () => {
      state.nodes['child-1'].metadata.expanded = true;
      state.activeNodeId = 'child-1';
      actions.moveDown();
      expect(state.activeNodeId).toBe('grandchild-1');
    });

    it('should handle deeply nested collapsed nodes', () => {
      state.nodes['great-grandchild-1'] = {
        id: 'great-grandchild-1',
        content: 'Great Grandchild 1',
        children: [],
        metadata: {},
      };
      state.nodes['grandchild-1'].children = ['great-grandchild-1'];

      state.nodes['child-1'].metadata.expanded = false;

      state.activeNodeId = 'child-1';
      actions.moveDown();
      expect(state.activeNodeId).toBe('child-2');
    });
  });
});
