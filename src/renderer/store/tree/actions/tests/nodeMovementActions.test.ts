import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNodeMovementActions } from '../nodeMovementActions';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../../../utils/ancestry';
import type { VisualEffectsActions } from '../visualEffectsActions';
import type { NavigationActions } from '../navigationActions';

const { mockAddToast } = vi.hoisted(() => ({
  mockAddToast: vi.fn(),
}));
vi.mock('../../../toast/toastStore', () => ({
  useToastStore: {
    getState: () => ({
      addToast: mockAddToast,
    }),
  },
}));

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
    mockAddToast.mockClear();
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
      mockNavigation,
      { executeCommand: mockExecuteCommand }
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
        mockNavigation,
        { executeCommand: mockExecuteCommand }
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

    it('should reject dropping a workflow node into a non-blueprint node', () => {
      state.nodes['node-2'] = {
        ...state.nodes['node-2'],
        metadata: { ...state.nodes['node-2'].metadata, isWorkflow: true, isBlueprint: true },
      };

      const originalChildren = [...state.nodes['node-1'].children];

      actions.dropNode('node-2', 'node-1', 'child');

      expect(state.nodes['node-1'].children).toEqual(originalChildren);
    });

    it('should show toast error when dropping workflow into non-blueprint', () => {
      state.nodes['node-2'] = {
        ...state.nodes['node-2'],
        metadata: { ...state.nodes['node-2'].metadata, isWorkflow: true, isBlueprint: true },
      };

      actions.dropNode('node-2', 'node-1', 'child');

      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot place a blueprint node in a non-blueprint node',
        'error'
      );
    });

    it('should allow dropping a workflow node into a blueprint node', () => {
      state.nodes['node-2'] = {
        ...state.nodes['node-2'],
        metadata: { ...state.nodes['node-2'].metadata, isWorkflow: true, isBlueprint: true },
      };
      state.nodes['node-1'] = {
        ...state.nodes['node-1'],
        metadata: { ...state.nodes['node-1'].metadata, isBlueprint: true },
      };

      actions.dropNode('node-2', 'node-1', 'child');

      expect(state.nodes['node-1'].children).toContain('node-2');
    });

    it('should reject dropping a workflow node into a workflow step', () => {
      // node-1 is a workflow, node-3 is its child (a step)
      state.nodes['node-1'] = {
        ...state.nodes['node-1'],
        metadata: { ...state.nodes['node-1'].metadata, isBlueprint: true, isWorkflow: true },
      };
      state.nodes['node-3'] = {
        ...state.nodes['node-3'],
        metadata: { ...state.nodes['node-3'].metadata, isBlueprint: true },
      };
      state.nodes['node-2'] = {
        ...state.nodes['node-2'],
        metadata: { ...state.nodes['node-2'].metadata, isWorkflow: true, isBlueprint: true },
      };

      const originalChildren = [...state.nodes['node-3'].children];
      actions.dropNode('node-2', 'node-3', 'child');

      expect(state.nodes['node-3'].children).toEqual(originalChildren);
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot place a workflow node in a workflow step',
        'error'
      );
    });

    it('should allow dropping a workflow into a nested workflow (itself a child of a workflow)', () => {
      // node-1 is a workflow, node-3 is a nested workflow inside node-1
      state.nodes['node-1'] = {
        ...state.nodes['node-1'],
        metadata: { ...state.nodes['node-1'].metadata, isBlueprint: true, isWorkflow: true },
      };
      state.nodes['node-3'] = {
        ...state.nodes['node-3'],
        metadata: { ...state.nodes['node-3'].metadata, isBlueprint: true, isWorkflow: true },
      };
      state.nodes['node-2'] = {
        ...state.nodes['node-2'],
        metadata: { ...state.nodes['node-2'].metadata, isWorkflow: true, isBlueprint: true },
      };

      actions.dropNode('node-2', 'node-3', 'child');

      expect(state.nodes['node-3'].children).toContain('node-2');
    });

    it('should reject dropping a workflow node into a context', () => {
      state.nodes['node-1'] = {
        ...state.nodes['node-1'],
        metadata: { ...state.nodes['node-1'].metadata, isBlueprint: true, isContextDeclaration: true },
      };
      state.nodes['node-2'] = {
        ...state.nodes['node-2'],
        metadata: { ...state.nodes['node-2'].metadata, isWorkflow: true, isBlueprint: true },
      };

      const originalChildren = [...state.nodes['node-1'].children];
      actions.dropNode('node-2', 'node-1', 'child');

      expect(state.nodes['node-1'].children).toEqual(originalChildren);
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot place a workflow node in a context',
        'error'
      );
    });

    it('should reject dropping a workflow node into a descendant of a context', () => {
      state.nodes['node-1'] = {
        ...state.nodes['node-1'],
        metadata: { ...state.nodes['node-1'].metadata, isBlueprint: true, isContextDeclaration: true },
      };
      state.nodes['node-3'] = {
        ...state.nodes['node-3'],
        metadata: { ...state.nodes['node-3'].metadata, isBlueprint: true },
      };
      state.nodes['node-2'] = {
        ...state.nodes['node-2'],
        metadata: { ...state.nodes['node-2'].metadata, isWorkflow: true, isBlueprint: true },
      };

      const originalChildren = [...state.nodes['node-3'].children];
      actions.dropNode('node-2', 'node-3', 'child');

      expect(state.nodes['node-3'].children).toEqual(originalChildren);
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot place a workflow node in a context',
        'error'
      );
    });
  });

  describe('workflow keyboard movement constraints', () => {
    it('should prevent indenting a workflow into a non-blueprint sibling', () => {
      // node-2 is a workflow, node-1 is not a blueprint — indent would make node-2 a child of node-1
      state.nodes['node-2'] = {
        ...state.nodes['node-2'],
        metadata: { ...state.nodes['node-2'].metadata, isWorkflow: true, isBlueprint: true },
      };

      actions.indentNode('node-2');

      expect(state.nodes['root'].children).toContain('node-2');
      expect(state.nodes['node-1'].children).not.toContain('node-2');
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot place a blueprint node in a non-blueprint node',
        'error'
      );
    });

    it('should allow indenting a workflow into a blueprint sibling', () => {
      state.nodes['node-2'] = {
        ...state.nodes['node-2'],
        metadata: { ...state.nodes['node-2'].metadata, isWorkflow: true, isBlueprint: true },
      };
      state.nodes['node-1'] = {
        ...state.nodes['node-1'],
        metadata: { ...state.nodes['node-1'].metadata, isBlueprint: true },
      };

      actions.indentNode('node-2');

      expect(state.nodes['node-1'].children).toContain('node-2');
    });

    it('should prevent indenting a workflow into a context', () => {
      state.nodes['node-2'] = {
        ...state.nodes['node-2'],
        metadata: { ...state.nodes['node-2'].metadata, isWorkflow: true, isBlueprint: true },
      };
      state.nodes['node-1'] = {
        ...state.nodes['node-1'],
        metadata: { ...state.nodes['node-1'].metadata, isBlueprint: true, isContextDeclaration: true },
      };

      actions.indentNode('node-2');

      expect(state.nodes['node-1'].children).not.toContain('node-2');
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot place a workflow node in a context',
        'error'
      );
    });

    it('should prevent indenting a workflow into a workflow step', () => {
      // node-1 is a workflow step (child of a workflow root)
      state.nodes['root'] = {
        ...state.nodes['root'],
        metadata: { ...state.nodes['root'].metadata, isWorkflow: true },
      };
      state.nodes['node-1'] = {
        ...state.nodes['node-1'],
        metadata: { ...state.nodes['node-1'].metadata, isBlueprint: true },
      };
      state.nodes['node-2'] = {
        ...state.nodes['node-2'],
        metadata: { ...state.nodes['node-2'].metadata, isWorkflow: true, isBlueprint: true },
      };

      actions.indentNode('node-2');

      expect(state.nodes['node-1'].children).not.toContain('node-2');
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot place a workflow node in a workflow step',
        'error'
      );
    });

    it('should prevent moving a workflow up into a non-blueprint sibling parent', () => {
      // node-3 is a workflow inside node-1. Moving up should try to go into node-1's previous sibling's parent.
      // But let's set up: node-1 has children [wf-node], node-2 has children []. Moving wf-node up
      // when it's the first child should try to move to previous sibling parent.
      state.nodes['node-1'].children = [];
      state.nodes['node-2'].children = ['wf-node'];
      state.nodes['wf-node'] = {
        id: 'wf-node',
        content: 'Workflow',
        children: [],
        metadata: { isWorkflow: true, isBlueprint: true },
      };
      state.ancestorRegistry['wf-node'] = ['root', 'node-2'];

      // Moving wf-node up: it's the first child of node-2, so it tries to go into node-1 (previous sibling)
      // node-1 is not a blueprint, so it should be rejected
      actions.moveNodeUp('wf-node');

      expect(state.nodes['node-2'].children).toContain('wf-node');
      expect(state.nodes['node-1'].children).not.toContain('wf-node');
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot place a blueprint node in a non-blueprint node',
        'error'
      );
    });

    it('should prevent moving a workflow down into a non-blueprint sibling parent', () => {
      state.nodes['node-1'].children = ['wf-node'];
      state.nodes['node-2'].children = [];
      state.nodes['wf-node'] = {
        id: 'wf-node',
        content: 'Workflow',
        children: [],
        metadata: { isWorkflow: true, isBlueprint: true },
      };
      state.ancestorRegistry['wf-node'] = ['root', 'node-1'];

      // Moving wf-node down: it's the last child of node-1, so it tries to go into node-2 (next sibling)
      // node-2 is not a blueprint, so it should be rejected
      actions.moveNodeDown('wf-node');

      expect(state.nodes['node-1'].children).toContain('wf-node');
      expect(state.nodes['node-2'].children).not.toContain('wf-node');
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot place a blueprint node in a non-blueprint node',
        'error'
      );
    });
  });

  describe('blueprint keyboard movement constraints', () => {
    it('should prevent indenting a blueprint node into a non-blueprint sibling', () => {
      state.nodes['node-1'] = {
        ...state.nodes['node-1'],
        metadata: { status: 'pending' },
      };
      state.nodes['node-2'] = {
        ...state.nodes['node-2'],
        metadata: { ...state.nodes['node-2'].metadata, isBlueprint: true },
      };

      actions.indentNode('node-2');

      expect(state.nodes['node-1'].children).not.toContain('node-2');
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot place a blueprint node in a non-blueprint node',
        'error'
      );
    });

    it('should allow indenting a blueprint node into a blueprint sibling', () => {
      state.nodes['node-1'] = {
        ...state.nodes['node-1'],
        metadata: { ...state.nodes['node-1'].metadata, isBlueprint: true },
      };
      state.nodes['node-2'] = {
        ...state.nodes['node-2'],
        metadata: { ...state.nodes['node-2'].metadata, isBlueprint: true },
      };

      actions.indentNode('node-2');

      expect(state.nodes['node-1'].children).toContain('node-2');
    });

    it('should prevent indenting a context node into a non-blueprint sibling', () => {
      state.nodes['node-2'] = {
        ...state.nodes['node-2'],
        metadata: { ...state.nodes['node-2'].metadata, isBlueprint: true, isContextDeclaration: true },
      };

      actions.indentNode('node-2');

      expect(state.nodes['node-1'].children).not.toContain('node-2');
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot place a blueprint node in a non-blueprint node',
        'error'
      );
    });

    it('should prevent moving a blueprint node up into a non-blueprint sibling parent', () => {
      state.nodes['node-2'].children = ['bp-node'];
      state.nodes['bp-node'] = {
        id: 'bp-node',
        content: 'Blueprint',
        children: [],
        metadata: { isBlueprint: true },
      };
      state.ancestorRegistry['bp-node'] = ['root', 'node-2'];

      // bp-node is the first child of node-2, moving up tries to go into node-1
      actions.moveNodeUp('bp-node');

      expect(state.nodes['node-2'].children).toContain('bp-node');
      expect(state.nodes['node-1'].children).not.toContain('bp-node');
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot place a blueprint node in a non-blueprint node',
        'error'
      );
    });

    it('should prevent moving a blueprint node down into a non-blueprint sibling parent', () => {
      state.nodes['node-1'].children = ['bp-node'];
      state.nodes['bp-node'] = {
        id: 'bp-node',
        content: 'Blueprint',
        children: [],
        metadata: { isBlueprint: true },
      };
      state.ancestorRegistry['bp-node'] = ['root', 'node-1'];

      // bp-node is the last child of node-1, moving down tries to go into node-2
      actions.moveNodeDown('bp-node');

      expect(state.nodes['node-1'].children).toContain('bp-node');
      expect(state.nodes['node-2'].children).not.toContain('bp-node');
      expect(mockAddToast).toHaveBeenCalledWith(
        'Cannot place a blueprint node in a non-blueprint node',
        'error'
      );
    });

    it('should allow non-blueprint nodes to move freely', () => {
      actions.indentNode('node-2');

      expect(state.nodes['node-1'].children).toContain('node-2');
    });
  });
});
