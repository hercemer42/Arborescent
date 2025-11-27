import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNodeMovementActions } from '../nodeMovementActions';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../../../services/ancestry';
import type { VisualEffectsActions } from '../visualEffectsActions';
import type { NavigationActions } from '../navigationActions';

describe('nodeMovementActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: AncestorRegistry;
    cursorPosition: number;
    rememberedVisualX: number | null;
    actions?: { executeCommand?: (cmd: unknown) => void };
  };
  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createNodeMovementActions>;
  let mockVisualEffects: VisualEffectsActions;
  let mockNavigation: NavigationActions;
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
          children: ['node-1', 'node-2'],
          metadata: {},
        },
        'node-1': {
          id: 'node-1',
          content: 'Task 1',
          children: ['node-3'],
          metadata: { status: 'pending' },
        },
        'node-2': {
          id: 'node-2',
          content: 'Task 2',
          children: [],
          metadata: { status: 'pending' },
        },
        'node-3': {
          id: 'node-3',
          content: 'Task 3',
          children: [],
          metadata: { status: 'pending' },
        },
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        'root': [],
        'node-1': ['root'],
        'node-2': ['root'],
        'node-3': ['root', 'node-1'],
      },
      cursorPosition: 0,
      rememberedVisualX: null,
      actions: { executeCommand: mockExecuteCommand },
    };

    setState = (partial) => {
      state = { ...state, ...partial };
    };

    mockVisualEffects = {
      flashNode: vi.fn(),
      scrollToNode: vi.fn(),
      startDeleteAnimation: vi.fn(),
      clearDeleteAnimation: vi.fn(),
    };

    mockNavigation = {
      moveUp: vi.fn(),
      moveDown: vi.fn(),
      moveBack: vi.fn(),
      moveForward: vi.fn(),
      toggleNode: vi.fn(),
    };

    actions = createNodeMovementActions(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => state as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState as any,
      undefined,
      mockVisualEffects,
      mockNavigation
    );
  });

  describe('indentNode', () => {
    it('should make node a child of previous sibling', () => {
      actions.indentNode('node-2');

      expect(state.nodes['root'].children).toEqual(['node-1']);
      expect(state.nodes['node-1'].children).toEqual(['node-3', 'node-2']);
    });

    it('should update ancestor registry', () => {
      actions.indentNode('node-2');

      expect(state.ancestorRegistry['node-2']).toEqual(['root', 'node-1']);
    });

    it('should not indent first child', () => {
      const originalRootChildren = [...state.nodes['root'].children];

      actions.indentNode('node-1');

      expect(state.nodes['root'].children).toEqual(originalRootChildren);
    });

    it('should handle deeply nested indentation', () => {
      state.nodes['node-1'].children = ['node-3', 'node-4'];
      state.nodes['node-4'] = {
        id: 'node-4',
        content: 'Task 4',
        children: [],
        metadata: { status: 'pending' },
      };
      state.ancestorRegistry['node-4'] = ['root', 'node-1'];

      actions.indentNode('node-4');

      expect(state.nodes['node-1'].children).toEqual(['node-3']);
      expect(state.nodes['node-3'].children).toEqual(['node-4']);
      expect(state.ancestorRegistry['node-4']).toEqual(['root', 'node-1', 'node-3']);
    });

    it('should call navigation.moveUp when indenting into collapsed parent', () => {
      state.nodes['node-1'].metadata = { expanded: false };

      actions.indentNode('node-2');

      expect(mockNavigation.moveUp).toHaveBeenCalledWith(0, null);
    });

    it('should call visualEffects.flashNode with parent and medium intensity when indenting into collapsed parent', () => {
      state.nodes['node-1'].metadata = { expanded: false };

      actions.indentNode('node-2');

      expect(mockVisualEffects.flashNode).toHaveBeenCalledWith('node-1', 'medium');
    });

    it('should not call navigation.moveUp when indenting into expanded parent', () => {
      state.nodes['node-1'].metadata = { expanded: true };

      actions.indentNode('node-2');

      expect(mockNavigation.moveUp).not.toHaveBeenCalled();
    });

    it('should not flash when indenting into parent with no children', () => {
      state.nodes['node-1'].children = [];
      state.nodes['node-1'].metadata = { expanded: false };

      actions.indentNode('node-2');

      expect(mockNavigation.moveUp).not.toHaveBeenCalled();
      expect(mockVisualEffects.flashNode).not.toHaveBeenCalled();
    });

    it('should call moveUp before reparenting when indenting into collapsed parent', () => {
      state.nodes['node-1'].metadata = { expanded: false };
      const callOrder: string[] = [];

      mockNavigation.moveUp = vi.fn(() => {
        callOrder.push('moveUp');
      });

      const originalSetState = setState;
      setState = (partial) => {
        callOrder.push('setState');
        originalSetState(partial);
      };

      actions = createNodeMovementActions(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        () => state as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setState as any,
        undefined,
        mockVisualEffects,
        mockNavigation
      );

      actions.indentNode('node-2');

      expect(callOrder[0]).toBe('moveUp');
      expect(callOrder[1]).toBe('setState');
    });
  });

  describe('outdentNode', () => {
    it('should make node a sibling of parent', () => {
      actions.outdentNode('node-3');

      expect(state.nodes['node-1'].children).toEqual([]);
      expect(state.nodes['root'].children).toEqual(['node-1', 'node-3', 'node-2']);
    });

    it('should update ancestor registry', () => {
      actions.outdentNode('node-3');

      expect(state.ancestorRegistry['node-3']).toEqual(['root']);
    });

    it('should not outdent nodes that are already children of root', () => {
      const originalRootChildren = [...state.nodes['root'].children];

      actions.outdentNode('node-1');

      expect(state.nodes['root'].children).toEqual(originalRootChildren);
    });

    it('should allow outdenting to root level', () => {
      actions.outdentNode('node-3');

      expect(state.nodes['node-1'].children).toEqual([]);
      expect(state.nodes['root'].children).toEqual(['node-1', 'node-3', 'node-2']);
      expect(state.ancestorRegistry['node-3']).toEqual(['root']);
    });

    it('should position outdented node after its parent', () => {
      state.nodes['node-1'].children = ['node-3', 'node-5'];
      state.nodes['node-5'] = {
        id: 'node-5',
        content: 'Task 5',
        children: [],
        metadata: { status: 'pending' },
      };
      state.ancestorRegistry['node-5'] = ['root', 'node-1'];

      actions.outdentNode('node-5');

      expect(state.nodes['root'].children).toEqual(['node-1', 'node-5', 'node-2']);
      expect(state.ancestorRegistry['node-5']).toEqual(['root']);
    });

    it('should call visualEffects.scrollToNode when outdenting', () => {
      actions.outdentNode('node-3');

      expect(mockVisualEffects.scrollToNode).toHaveBeenCalledWith('node-3');
    });
  });

  describe('moveNodeUp', () => {
    it('should swap node with previous sibling', () => {
      actions.moveNodeUp('node-2');

      expect(state.nodes['root'].children).toEqual(['node-2', 'node-1']);
    });

    it('should not move first child of root up', () => {
      const originalChildren = [...state.nodes['root'].children];

      actions.moveNodeUp('node-1');

      expect(state.nodes['root'].children).toEqual(originalChildren);
    });

    it('should work with nested nodes', () => {
      state.nodes['node-1'].children = ['node-3', 'node-4'];
      state.nodes['node-4'] = {
        id: 'node-4',
        content: 'Task 4',
        children: [],
        metadata: { status: 'pending' },
      };
      state.ancestorRegistry['node-4'] = ['root', 'node-1'];

      actions.moveNodeUp('node-4');

      expect(state.nodes['node-1'].children).toEqual(['node-4', 'node-3']);
    });

    it('should move first child to become last child of previous sibling', () => {
      state.nodes['node-1'].children = ['node-3'];
      state.nodes['node-2'].children = ['node-4'];
      state.nodes['node-4'] = {
        id: 'node-4',
        content: 'Task 4',
        children: [],
        metadata: { status: 'pending' },
      };
      state.ancestorRegistry['node-4'] = ['root', 'node-2'];

      actions.moveNodeUp('node-4');

      expect(state.nodes['node-1'].children).toEqual(['node-3', 'node-4']);
      expect(state.nodes['node-2'].children).toEqual([]);
      expect(state.ancestorRegistry['node-4']).toEqual(['root', 'node-1']);
    });
  });

  describe('moveNodeDown', () => {
    it('should swap node with next sibling', () => {
      actions.moveNodeDown('node-1');

      expect(state.nodes['root'].children).toEqual(['node-2', 'node-1']);
    });

    it('should not move last child of root down', () => {
      const originalChildren = [...state.nodes['root'].children];

      actions.moveNodeDown('node-2');

      expect(state.nodes['root'].children).toEqual(originalChildren);
    });

    it('should work with nested nodes', () => {
      state.nodes['node-1'].children = ['node-3', 'node-4'];
      state.nodes['node-4'] = {
        id: 'node-4',
        content: 'Task 4',
        children: [],
        metadata: { status: 'pending' },
      };
      state.ancestorRegistry['node-4'] = ['root', 'node-1'];

      actions.moveNodeDown('node-3');

      expect(state.nodes['node-1'].children).toEqual(['node-4', 'node-3']);
    });

    it('should move last child to become first child of next sibling', () => {
      state.nodes['node-1'].children = ['node-4'];
      state.nodes['node-2'].children = ['node-3'];
      state.nodes['node-4'] = {
        id: 'node-4',
        content: 'Task 4',
        children: [],
        metadata: { status: 'pending' },
      };
      state.ancestorRegistry['node-4'] = ['root', 'node-1'];

      actions.moveNodeDown('node-4');

      expect(state.nodes['node-1'].children).toEqual([]);
      expect(state.nodes['node-2'].children).toEqual(['node-4', 'node-3']);
      expect(state.ancestorRegistry['node-4']).toEqual(['root', 'node-2']);
    });
  });

  describe('dropNode', () => {
    it('should drop node as child of target', () => {
      actions.dropNode('node-2', 'node-1', 'child');

      // node-2 should now be a child of node-1
      expect(state.nodes['node-1'].children).toContain('node-2');
      expect(state.nodes['root'].children).not.toContain('node-2');
      expect(state.ancestorRegistry['node-2']).toEqual(['root', 'node-1']);
    });

    it('should drop node before target', () => {
      actions.dropNode('node-2', 'node-1', 'before');

      // node-2 should be before node-1 in root's children
      expect(state.nodes['root'].children).toEqual(['node-2', 'node-1']);
    });

    it('should drop node after target', () => {
      actions.dropNode('node-1', 'node-2', 'after');

      // node-1 should be after node-2 in root's children
      expect(state.nodes['root'].children).toEqual(['node-2', 'node-1']);
    });

    it('should update ancestor registry when dropping as child', () => {
      actions.dropNode('node-2', 'node-1', 'child');

      expect(state.ancestorRegistry['node-2']).toEqual(['root', 'node-1']);
    });

    it('should not drop node onto itself', () => {
      const originalChildren = [...state.nodes['node-1'].children];

      actions.dropNode('node-1', 'node-1', 'child');

      // Should not change
      expect(state.nodes['node-1'].children).toEqual(originalChildren);
    });

    it('should not drop node onto its own descendant', () => {
      const originalChildren = [...state.nodes['node-3'].children];

      actions.dropNode('node-1', 'node-3', 'child');

      // Should not change (node-3 is a descendant of node-1)
      expect(state.nodes['node-3'].children).toEqual(originalChildren);
      expect(state.ancestorRegistry['node-1']).toEqual(['root']);
    });

    it('should not drop if already a child of target parent', () => {
      // node-3 is already a child of node-1
      const originalChildren = [...state.nodes['node-1'].children];

      actions.dropNode('node-3', 'node-1', 'child');

      // Should not duplicate
      expect(state.nodes['node-1'].children).toEqual(originalChildren);
    });

    it('should call visualEffects.flashNode when dropping as child into expanded parent', () => {
      actions.dropNode('node-2', 'node-1', 'child');

      expect(mockVisualEffects.flashNode).toHaveBeenCalledWith('node-1', 'light');
    });

    it('should call visualEffects.flashNode when dropping as child into collapsed parent', () => {
      // Make node-1 collapsed
      state.nodes['node-1'].metadata.expanded = false;

      actions.dropNode('node-2', 'node-1', 'child');

      expect(mockVisualEffects.flashNode).toHaveBeenCalledWith('node-1', 'medium');
    });

    it('should call visualEffects.flashNode with node when dropping before/after', () => {
      actions.dropNode('node-2', 'node-1', 'before');

      expect(mockVisualEffects.flashNode).toHaveBeenCalledWith('node-2');
    });

    it('should handle dropping into deep nested structure', () => {
      // Create deeper structure: node-1 > node-3 > node-3-1
      state.nodes['node-3'].children = ['node-3-1'];
      state.nodes['node-3-1'] = {
        id: 'node-3-1',
        content: 'Task 3.1',
        children: [],
        metadata: {},
      };
      state.ancestorRegistry['node-3-1'] = ['root', 'node-1', 'node-3'];

      actions.dropNode('node-2', 'node-3-1', 'child');

      expect(state.nodes['node-3-1'].children).toContain('node-2');
      expect(state.ancestorRegistry['node-2']).toEqual(['root', 'node-1', 'node-3', 'node-3-1']);
    });

    it('should handle complex before/after positioning', () => {
      // Add more children to test positioning
      state.nodes['root'].children = ['node-1', 'node-2', 'node-3', 'node-4'];
      state.nodes['node-4'] = {
        id: 'node-4',
        content: 'Task 4',
        children: [],
        metadata: {},
      };
      state.ancestorRegistry['node-4'] = ['root'];

      // Move node-4 before node-2
      actions.dropNode('node-4', 'node-2', 'before');

      expect(state.nodes['root'].children).toEqual(['node-1', 'node-4', 'node-2', 'node-3']);
    });
  });
});
