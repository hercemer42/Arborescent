import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createContextActions } from '../contextActions';
import type { TreeNode } from '@shared/types';
import { getIsContextChild, getContextDeclarationId } from '../../../../utils/nodeHelpers';

describe('contextActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    contextDeclarations: { nodeId: string; content: string; icon: string }[];
    ancestorRegistry: Record<string, string[]>;
  };
  let state: TestState;
  let setState: (partial: Partial<TestState> | ((state: TestState) => Partial<TestState>)) => void;
  let actions: ReturnType<typeof createContextActions>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state = {
      nodes: {
        'root': {
          id: 'root',
          content: 'Root',
          children: ['node-1', 'node-2'],
          metadata: { isBlueprint: true }, // Root must be blueprint for children to be declared as context
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
      contextDeclarations: [],
      ancestorRegistry: {
        'root': [],
        'node-1': ['root'],
        'node-2': ['root'],
        'node-3': ['node-1', 'root'],
      },
    };

    setState = (partial) => {
      if (typeof partial === 'function') {
        state = { ...state, ...partial(state) };
      } else {
        state = { ...state, ...partial };
      }
    };

    mockTriggerAutosave = vi.fn();

    actions = createContextActions(
      () => state,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState as any,
      mockTriggerAutosave
    );
  });

  describe('declareAsContext', () => {
    it('should set isContextDeclaration to true on a node', () => {
      actions.declareAsContext('node-1');
      expect(state.nodes['node-1'].metadata.isContextDeclaration).toBe(true);
    });

    it('should set default icon to lightbulb', () => {
      actions.declareAsContext('node-1');
      expect(state.nodes['node-1'].metadata.blueprintIcon).toBe('lightbulb');
    });

    it('should set custom icon when provided', () => {
      actions.declareAsContext('node-1', 'star');
      expect(state.nodes['node-1'].metadata.blueprintIcon).toBe('star');
    });

    it('should trigger autosave', () => {
      actions.declareAsContext('node-1');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should not modify other nodes', () => {
      actions.declareAsContext('node-1');
      expect(state.nodes['node-2'].metadata.isContextDeclaration).toBeUndefined();
    });

    it('should do nothing if node does not exist', () => {
      const originalNodes = { ...state.nodes };
      actions.declareAsContext('non-existent');
      expect(state.nodes).toEqual(originalNodes);
    });
  });

  describe('removeContextDeclaration', () => {
    it('should set isContextDeclaration to false', () => {
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-1'].metadata.blueprintIcon = 'lightbulb';
      actions.removeContextDeclaration('node-1');
      expect(state.nodes['node-1'].metadata.isContextDeclaration).toBe(false);
    });

    it('should clear the blueprint icon', () => {
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-1'].metadata.blueprintIcon = 'lightbulb';
      actions.removeContextDeclaration('node-1');
      expect(state.nodes['node-1'].metadata.blueprintIcon).toBeUndefined();
    });

    it('should trigger autosave', () => {
      actions.removeContextDeclaration('node-1');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should clear appliedContextIds from nodes that had this context applied', () => {
      // Set up node-1 as a context declaration
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-1'].metadata.blueprintIcon = 'star';
      // Apply context to node-2 and node-3
      state.nodes['node-2'].metadata.appliedContextIds = ['node-1'];
      state.nodes['node-3'].metadata.appliedContextIds = ['node-1'];

      actions.removeContextDeclaration('node-1');

      expect(state.nodes['node-2'].metadata.appliedContextIds).toBeUndefined();
      expect(state.nodes['node-3'].metadata.appliedContextIds).toBeUndefined();
    });

    it('should only remove the specific context from appliedContextIds', () => {
      // Set up node-1 as a context declaration
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-1'].metadata.blueprintIcon = 'star';
      // node-2 has multiple contexts applied
      state.nodes['node-2'].metadata.appliedContextIds = ['node-1', 'other-context'];

      actions.removeContextDeclaration('node-1');

      expect(state.nodes['node-2'].metadata.appliedContextIds).toEqual(['other-context']);
    });
  });

  describe('applyContext', () => {
    beforeEach(() => {
      // Set up node-1 as a context declaration
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-1'].metadata.blueprintIcon = 'star';
    });

    it('should add context to appliedContextIds on the target node', () => {
      actions.applyContext('node-2', 'node-1');
      expect(state.nodes['node-2'].metadata.appliedContextIds).toEqual(['node-1']);
    });

    it('should trigger autosave', () => {
      actions.applyContext('node-2', 'node-1');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should allow applying context to a context declaration', () => {
      state.nodes['node-2'].metadata.isContextDeclaration = true;
      actions.applyContext('node-2', 'node-1');
      expect(state.nodes['node-2'].metadata.appliedContextIds).toEqual(['node-1']);
    });

    it('should set activeContextId on context declarations (same as regular nodes)', () => {
      state.nodes['node-2'].metadata.isContextDeclaration = true;
      actions.applyContext('node-2', 'node-1');
      expect(state.nodes['node-2'].metadata.activeContextId).toBe('node-1');
    });

    it('should do nothing if target node does not exist', () => {
      actions.applyContext('non-existent', 'node-1');
      expect(mockTriggerAutosave).not.toHaveBeenCalled();
    });

    it('should do nothing if context node does not exist', () => {
      actions.applyContext('node-2', 'non-existent');
      expect(mockTriggerAutosave).not.toHaveBeenCalled();
    });

    it('should allow applying multiple contexts', () => {
      state.nodes['node-3'].metadata.isContextDeclaration = true;
      state.nodes['node-3'].metadata.blueprintIcon = 'flag';

      actions.applyContext('node-2', 'node-1');
      expect(state.nodes['node-2'].metadata.appliedContextIds).toEqual(['node-1']);

      actions.applyContext('node-2', 'node-3');
      expect(state.nodes['node-2'].metadata.appliedContextIds).toEqual(['node-1', 'node-3']);
    });

    it('should not add duplicate contexts', () => {
      actions.applyContext('node-2', 'node-1');
      actions.applyContext('node-2', 'node-1');
      expect(state.nodes['node-2'].metadata.appliedContextIds).toEqual(['node-1']);
    });

    it('should auto-set activeContextId when first context applied to regular node', () => {
      actions.applyContext('node-2', 'node-1');
      expect(state.nodes['node-2'].metadata.activeContextId).toBe('node-1');
    });

    it('should keep existing activeContextId when additional contexts applied', () => {
      state.nodes['node-3'].metadata.isContextDeclaration = true;
      state.nodes['node-3'].metadata.blueprintIcon = 'flag';

      actions.applyContext('node-2', 'node-1');
      expect(state.nodes['node-2'].metadata.activeContextId).toBe('node-1');

      actions.applyContext('node-2', 'node-3');
      expect(state.nodes['node-2'].metadata.activeContextId).toBe('node-1');
    });
  });

  describe('removeAppliedContext', () => {
    beforeEach(() => {
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-2'].metadata.appliedContextIds = ['node-1'];
      state.nodes['node-2'].metadata.activeContextId = 'node-1';
    });

    it('should remove specific context from appliedContextIds', () => {
      actions.removeAppliedContext('node-2', 'node-1');
      expect(state.nodes['node-2'].metadata.appliedContextIds).toBeUndefined();
    });

    it('should remove all contexts when no contextId specified', () => {
      state.nodes['node-2'].metadata.appliedContextIds = ['node-1', 'other-context'];
      actions.removeAppliedContext('node-2');
      expect(state.nodes['node-2'].metadata.appliedContextIds).toBeUndefined();
    });

    it('should keep other contexts when removing specific one', () => {
      state.nodes['node-2'].metadata.appliedContextIds = ['node-1', 'other-context'];
      actions.removeAppliedContext('node-2', 'node-1');
      expect(state.nodes['node-2'].metadata.appliedContextIds).toEqual(['other-context']);
    });

    it('should trigger autosave', () => {
      actions.removeAppliedContext('node-2', 'node-1');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should do nothing if node does not exist', () => {
      actions.removeAppliedContext('non-existent');
      expect(mockTriggerAutosave).not.toHaveBeenCalled();
    });

    it('should clear activeContextId when all contexts removed', () => {
      actions.removeAppliedContext('node-2', 'node-1');
      expect(state.nodes['node-2'].metadata.activeContextId).toBeUndefined();
    });

    it('should clear activeContextId when removing all with no contextId', () => {
      state.nodes['node-2'].metadata.appliedContextIds = ['node-1', 'other-context'];
      actions.removeAppliedContext('node-2');
      expect(state.nodes['node-2'].metadata.activeContextId).toBeUndefined();
    });

    it('should promote first remaining context to active when active is removed', () => {
      state.nodes['node-2'].metadata.appliedContextIds = ['node-1', 'other-context'];
      state.nodes['node-2'].metadata.activeContextId = 'node-1';
      actions.removeAppliedContext('node-2', 'node-1');
      expect(state.nodes['node-2'].metadata.activeContextId).toBe('other-context');
    });

    it('should keep activeContextId when non-active context removed', () => {
      state.nodes['node-2'].metadata.appliedContextIds = ['node-1', 'other-context'];
      state.nodes['node-2'].metadata.activeContextId = 'node-1';
      actions.removeAppliedContext('node-2', 'other-context');
      expect(state.nodes['node-2'].metadata.activeContextId).toBe('node-1');
    });
  });

  describe('nested context declarations', () => {
    beforeEach(() => {
      // Set up a nested context structure:
      // root (blueprint)
      //   └── node-1 (context declaration)
      //       └── node-3 (context child - derived from ancestors)
      //           └── nested-child (child of node-3)
      state.nodes['node-1'].metadata = {
        ...state.nodes['node-1'].metadata,
        isContextDeclaration: true,
        blueprintIcon: 'star',
        isBlueprint: true,
      };
      state.nodes['node-3'].metadata = {
        ...state.nodes['node-3'].metadata,
        isBlueprint: true,
      };
      state.nodes['node-3'].children = ['nested-child'];
      state.nodes['nested-child'] = {
        id: 'nested-child',
        content: 'Nested Child',
        children: [],
        metadata: {
          isBlueprint: true,
        },
      };
      state.ancestorRegistry['nested-child'] = ['node-3', 'node-1', 'root'];
    });

    it('should skip nested context declarations when declaring as context', () => {
      // node-3 becomes a nested context declaration
      actions.declareAsContext('node-3', 'flag');

      // node-3 should now be a context declaration, NOT a child
      expect(state.nodes['node-3'].metadata.isContextDeclaration).toBe(true);
      expect(state.nodes['node-3'].metadata.blueprintIcon).toBe('flag');
      expect(getIsContextChild('node-3', state.nodes, state.ancestorRegistry)).toBe(false);

      // nested-child should now point to node-3, not node-1 (derived from ancestors)
      expect(getIsContextChild('nested-child', state.nodes, state.ancestorRegistry)).toBe(true);
      expect(getContextDeclarationId('nested-child', state.nodes, state.ancestorRegistry)).toBe('node-3');
    });

    it('should inherit ancestor context when nested context is removed', () => {
      // First declare node-3 as nested context
      actions.declareAsContext('node-3', 'flag');

      // Then remove the nested context declaration
      actions.removeContextDeclaration('node-3');

      // node-3 should now be a context child of node-1 again (derived from ancestors)
      expect(state.nodes['node-3'].metadata.isContextDeclaration).toBe(false);
      expect(getIsContextChild('node-3', state.nodes, state.ancestorRegistry)).toBe(true);
      expect(getContextDeclarationId('node-3', state.nodes, state.ancestorRegistry)).toBe('node-1');
      // Should keep blueprint status since it's still in a context tree
      expect(state.nodes['node-3'].metadata.isBlueprint).toBe(true);
    });

    it('should update descendants to point to ancestor context when nested context removed', () => {
      // First declare node-3 as nested context
      actions.declareAsContext('node-3', 'flag');

      // Verify nested-child points to node-3 (derived from ancestors)
      expect(getContextDeclarationId('nested-child', state.nodes, state.ancestorRegistry)).toBe('node-3');

      // Remove the nested context declaration
      actions.removeContextDeclaration('node-3');

      // nested-child should now point to the ancestor context (node-1)
      expect(getIsContextChild('nested-child', state.nodes, state.ancestorRegistry)).toBe(true);
      expect(getContextDeclarationId('nested-child', state.nodes, state.ancestorRegistry)).toBe('node-1');
    });

    it('should skip nested context subtrees when declaring parent as context', () => {
      // First declare node-3 as nested context (child of node-1)
      actions.declareAsContext('node-3', 'flag');

      // Now add a new child to node-1 (sibling of node-3)
      state.nodes['sibling'] = {
        id: 'sibling',
        content: 'Sibling',
        children: [],
        metadata: {},
      };
      state.nodes['node-1'].children.push('sibling');
      state.ancestorRegistry['sibling'] = ['node-1', 'root'];

      // Re-declare node-1 as context (refresh the context tree)
      actions.declareAsContext('node-1', 'heart');

      // node-3 should STILL be its own context declaration (not overwritten)
      expect(state.nodes['node-3'].metadata.isContextDeclaration).toBe(true);
      expect(state.nodes['node-3'].metadata.blueprintIcon).toBe('flag');

      // nested-child should still point to node-3 (derived from ancestors)
      expect(getContextDeclarationId('nested-child', state.nodes, state.ancestorRegistry)).toBe('node-3');

      // sibling should be a context child of node-1 (derived from ancestors)
      expect(getIsContextChild('sibling', state.nodes, state.ancestorRegistry)).toBe(true);
      expect(getContextDeclarationId('sibling', state.nodes, state.ancestorRegistry)).toBe('node-1');
    });
  });

  describe('setActiveContext', () => {
    beforeEach(() => {
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-3'].metadata.isContextDeclaration = true;
      state.nodes['node-2'].metadata.appliedContextIds = ['node-1', 'node-3'];
      state.nodes['node-2'].metadata.activeContextId = 'node-1';
    });

    it('should set appliedContextId on the node', () => {
      actions.setActiveContext('node-2', 'node-3');
      expect(state.nodes['node-2'].metadata.appliedContextId).toBe('node-3');
    });

    it('should trigger autosave', () => {
      actions.setActiveContext('node-2', 'node-3');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should do nothing if node does not exist', () => {
      actions.setActiveContext('non-existent', 'node-1');
      expect(mockTriggerAutosave).not.toHaveBeenCalled();
    });

    it('should allow setting appliedContextId on context declarations', () => {
      state.nodes['node-2'].metadata.isContextDeclaration = true;
      actions.setActiveContext('node-2', 'node-3');
      expect(state.nodes['node-2'].metadata.appliedContextId).toBe('node-3');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should not set appliedContextId for non-existent context', () => {
      actions.setActiveContext('node-2', 'non-existent-context');
      // Should not change since context doesn't exist
      expect(state.nodes['node-2'].metadata.appliedContextId).toBeUndefined();
      expect(mockTriggerAutosave).not.toHaveBeenCalled();
    });
  });
});
