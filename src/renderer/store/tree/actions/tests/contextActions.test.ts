import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createContextActions } from '../contextActions';
import type { TreeNode } from '@shared/types';

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
      expect(state.nodes['node-1'].metadata.contextIcon).toBe('lightbulb');
    });

    it('should set custom icon when provided', () => {
      actions.declareAsContext('node-1', 'star');
      expect(state.nodes['node-1'].metadata.contextIcon).toBe('star');
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

  describe('setContextIcon', () => {
    it('should update the context icon', () => {
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-1'].metadata.contextIcon = 'lightbulb';
      actions.setContextIcon('node-1', 'star');
      expect(state.nodes['node-1'].metadata.contextIcon).toBe('star');
    });

    it('should trigger autosave', () => {
      actions.setContextIcon('node-1', 'star');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });
  });

  describe('removeContextDeclaration', () => {
    it('should set isContextDeclaration to false', () => {
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-1'].metadata.contextIcon = 'lightbulb';
      actions.removeContextDeclaration('node-1');
      expect(state.nodes['node-1'].metadata.isContextDeclaration).toBe(false);
    });

    it('should clear the context icon', () => {
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-1'].metadata.contextIcon = 'lightbulb';
      actions.removeContextDeclaration('node-1');
      expect(state.nodes['node-1'].metadata.contextIcon).toBeUndefined();
    });

    it('should trigger autosave', () => {
      actions.removeContextDeclaration('node-1');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should clear appliedContextIds from nodes that had this context applied', () => {
      // Set up node-1 as a context declaration
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-1'].metadata.contextIcon = 'star';
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
      state.nodes['node-1'].metadata.contextIcon = 'star';
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
      state.nodes['node-1'].metadata.contextIcon = 'star';
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
      state.nodes['node-3'].metadata.contextIcon = 'flag';

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
      state.nodes['node-3'].metadata.contextIcon = 'flag';

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

  describe('setActiveContext', () => {
    beforeEach(() => {
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-3'].metadata.isContextDeclaration = true;
      state.nodes['node-2'].metadata.appliedContextIds = ['node-1', 'node-3'];
      state.nodes['node-2'].metadata.activeContextId = 'node-1';
    });

    it('should set activeContextId on the node', () => {
      actions.setActiveContext('node-2', 'node-3');
      expect(state.nodes['node-2'].metadata.activeContextId).toBe('node-3');
    });

    it('should trigger autosave', () => {
      actions.setActiveContext('node-2', 'node-3');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should do nothing if node does not exist', () => {
      actions.setActiveContext('non-existent', 'node-1');
      expect(mockTriggerAutosave).not.toHaveBeenCalled();
    });

    it('should allow setting activeContextId on context declarations', () => {
      state.nodes['node-2'].metadata.isContextDeclaration = true;
      actions.setActiveContext('node-2', 'node-3');
      expect(state.nodes['node-2'].metadata.activeContextId).toBe('node-3');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should not set activeContextId for context not applied to node', () => {
      actions.setActiveContext('node-2', 'non-applied-context');
      expect(state.nodes['node-2'].metadata.activeContextId).toBe('node-1');
      expect(mockTriggerAutosave).not.toHaveBeenCalled();
    });
  });
});
