import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNodeActions } from '../nodeActions';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../../../utils/ancestry';

describe('nodeActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: AncestorRegistry;
    activeNodeId: string | null;
    cursorPosition: number;
    rememberedVisualX: number | null;
    collaboratingNodeId: string | null;
    contextDeclarations: { nodeId: string; content: string; icon: string }[];
    actions?: { executeCommand?: (cmd: unknown) => void };
  };
  let state: TestState;
  let setState: (partial: Partial<TestState> | ((state: TestState) => Partial<TestState>)) => void;
  let actions: ReturnType<typeof createNodeActions>;
  let mockTriggerAutosave: ReturnType<typeof vi.fn>;
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
      activeNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      collaboratingNodeId: null,
      contextDeclarations: [],
      actions: { executeCommand: mockExecuteCommand },
    };

    setState = (partial) => {
      if (typeof partial === 'function') {
        state = { ...state, ...partial(state) };
      } else {
        state = { ...state, ...partial };
      }
    };

    mockTriggerAutosave = vi.fn();

    actions = createNodeActions(
      () => state,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState as any,
      mockTriggerAutosave
    );
  });

  describe('selectNode', () => {
    it('should select a node', () => {
      actions.selectNode('node-1');
      expect(state.activeNodeId).toBe('node-1');
    });
  });

  describe('updateContent', () => {
    it('should update node content', () => {
      actions.updateContent('node-1', 'Updated Task');
      expect(state.nodes['node-1'].content).toBe('Updated Task');
    });

    it('should update content without affecting other nodes', () => {
      actions.updateContent('node-1', 'Updated Task');
      expect(state.nodes['node-1'].content).toBe('Updated Task');
      expect(state.nodes['node-2'].content).toBe('Task 2');
    });
  });

  describe('updateStatus', () => {
    it('should update task status', () => {
      actions.updateStatus('node-1', 'completed');
      expect(state.nodes['node-1'].metadata.status).toBe('completed');
    });

    it('should trigger autosave', () => {
      actions.updateStatus('node-1', 'completed');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });
  });

  describe('toggleStatus', () => {
    it('should toggle status from pending to completed', () => {
      actions.toggleStatus('node-1');
      expect(state.nodes['node-1'].metadata.status).toBe('completed');
    });

    it('should toggle status from completed to failed', () => {
      state.nodes['node-1'].metadata.status = 'completed';
      actions.toggleStatus('node-1');
      expect(state.nodes['node-1'].metadata.status).toBe('failed');
    });

    it('should toggle status from failed to pending', () => {
      state.nodes['node-1'].metadata.status = 'failed';
      actions.toggleStatus('node-1');
      expect(state.nodes['node-1'].metadata.status).toBe('pending');
    });

    it('should toggle to completed if node has no status', () => {
      delete state.nodes['root'].metadata.status;
      actions.toggleStatus('root');
      // Undefined status is treated as 'pending', so it toggles to 'completed'
      expect(state.nodes['root'].metadata.status).toBe('completed');
    });

    it('should trigger autosave', () => {
      actions.toggleStatus('node-1');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });
  });

  describe('createNode', () => {
    describe('when node is expanded and has children', () => {
      it('should create a new child node at first position', () => {
        actions.createNode('node-1');

        expect(state.nodes['node-1'].children).toHaveLength(2);

        const children = state.nodes['node-1'].children;
        expect(children[1]).toBe('node-3');

        const newNodeId = children[0];
        const newNode = state.nodes[newNodeId];

        expect(newNode).toBeDefined();
        expect(newNode.content).toBe('');
        expect(newNode.children).toEqual([]);
        expect(newNode.metadata.status).toBe('pending');
      });

      it('should select the new child node with cursor at position 0', () => {
        actions.createNode('node-1');

        const newNodeId = state.nodes['node-1'].children[0];
        expect(state.activeNodeId).toBe(newNodeId);
        expect(state.cursorPosition).toBe(0);
        expect(state.rememberedVisualX).toBeNull();
      });

      it('should update ancestor registry for child node', () => {
        actions.createNode('node-1');

        const newNodeId = state.nodes['node-1'].children[0];
        expect(state.ancestorRegistry[newNodeId]).toEqual(['root', 'node-1']);
      });
    });

    describe('when node is expanded but has no children', () => {
      it('should create a sibling node after current node', () => {
        actions.createNode('node-2');

        expect(state.nodes['node-2'].children).toHaveLength(0);
        expect(state.nodes['root'].children).toHaveLength(3);

        const children = state.nodes['root'].children;
        expect(children[0]).toBe('node-1');
        expect(children[1]).toBe('node-2');

        const newNodeId = children[2];
        const newNode = state.nodes[newNodeId];

        expect(newNode).toBeDefined();
        expect(newNode.content).toBe('');
        expect(newNode.children).toEqual([]);
        expect(newNode.metadata.status).toBe('pending');
      });

      it('should update ancestor registry for sibling node', () => {
        actions.createNode('node-2');

        const newNodeId = state.nodes['root'].children[2];
        expect(state.ancestorRegistry[newNodeId]).toEqual(['root']);
      });
    });

    describe('when node is collapsed', () => {
      beforeEach(() => {
        state.nodes['node-1'].metadata.expanded = false;
      });

      it('should create a new sibling node after current node', () => {
        actions.createNode('node-1');

        expect(state.nodes['root'].children).toHaveLength(3);

        const children = state.nodes['root'].children;
        expect(children[0]).toBe('node-1');
        expect(children[2]).toBe('node-2');

        const newNodeId = children[1];
        const newNode = state.nodes[newNodeId];

        expect(newNode).toBeDefined();
        expect(newNode.content).toBe('');
        expect(newNode.children).toEqual([]);
        expect(newNode.metadata.status).toBe('pending');
      });

      it('should select the new sibling node with cursor at position 0', () => {
        actions.createNode('node-1');

        const newNodeId = state.nodes['root'].children[1];
        expect(state.activeNodeId).toBe(newNodeId);
        expect(state.cursorPosition).toBe(0);
        expect(state.rememberedVisualX).toBeNull();
      });

      it('should update ancestor registry for sibling node', () => {
        actions.createNode('node-1');

        const newNodeId = state.nodes['root'].children[1];
        expect(state.ancestorRegistry[newNodeId]).toEqual(['root']);
      });
    });

    it('should create new nodes with default status', () => {
      actions.createNode('node-1');

      const newNodeId = state.nodes['node-1'].children[0];
      expect(state.nodes[newNodeId].metadata.status).toBe('pending');
    });
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

    it('should clear appliedContextId from nodes that had this context applied', () => {
      // Set up node-1 as a context declaration
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-1'].metadata.contextIcon = 'star';
      // Apply context to node-2 and node-3
      state.nodes['node-2'].metadata.appliedContextId = 'node-1';
      state.nodes['node-3'].metadata.appliedContextId = 'node-1';

      actions.removeContextDeclaration('node-1');

      expect(state.nodes['node-2'].metadata.appliedContextId).toBeUndefined();
      expect(state.nodes['node-3'].metadata.appliedContextId).toBeUndefined();
    });

    it('should not affect nodes with different appliedContextId', () => {
      // Set up node-1 as a context declaration
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-1'].metadata.contextIcon = 'star';
      // node-2 has node-1 as context, node-3 has a different context
      state.nodes['node-2'].metadata.appliedContextId = 'node-1';
      state.nodes['node-3'].metadata.appliedContextId = 'other-context';

      actions.removeContextDeclaration('node-1');

      expect(state.nodes['node-2'].metadata.appliedContextId).toBeUndefined();
      expect(state.nodes['node-3'].metadata.appliedContextId).toBe('other-context');
    });
  });

  describe('applyContext', () => {
    beforeEach(() => {
      // Set up node-1 as a context declaration
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-1'].metadata.contextIcon = 'star';
    });

    it('should set appliedContextId on the target node', () => {
      actions.applyContext('node-2', 'node-1');
      expect(state.nodes['node-2'].metadata.appliedContextId).toBe('node-1');
    });

    it('should trigger autosave', () => {
      actions.applyContext('node-2', 'node-1');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should not apply context to a context declaration', () => {
      state.nodes['node-2'].metadata.isContextDeclaration = true;
      actions.applyContext('node-2', 'node-1');
      expect(state.nodes['node-2'].metadata.appliedContextId).toBeUndefined();
    });

    it('should do nothing if target node does not exist', () => {
      actions.applyContext('non-existent', 'node-1');
      expect(mockTriggerAutosave).not.toHaveBeenCalled();
    });

    it('should do nothing if context node does not exist', () => {
      actions.applyContext('node-2', 'non-existent');
      expect(mockTriggerAutosave).not.toHaveBeenCalled();
    });

    it('should allow changing applied context', () => {
      state.nodes['node-3'].metadata.isContextDeclaration = true;
      state.nodes['node-3'].metadata.contextIcon = 'flag';

      actions.applyContext('node-2', 'node-1');
      expect(state.nodes['node-2'].metadata.appliedContextId).toBe('node-1');

      actions.applyContext('node-2', 'node-3');
      expect(state.nodes['node-2'].metadata.appliedContextId).toBe('node-3');
    });
  });

  describe('removeAppliedContext', () => {
    beforeEach(() => {
      state.nodes['node-1'].metadata.isContextDeclaration = true;
      state.nodes['node-2'].metadata.appliedContextId = 'node-1';
    });

    it('should remove appliedContextId from the node', () => {
      actions.removeAppliedContext('node-2');
      expect(state.nodes['node-2'].metadata.appliedContextId).toBeUndefined();
    });

    it('should trigger autosave', () => {
      actions.removeAppliedContext('node-2');
      expect(mockTriggerAutosave).toHaveBeenCalled();
    });

    it('should do nothing if node does not exist', () => {
      actions.removeAppliedContext('non-existent');
      expect(mockTriggerAutosave).not.toHaveBeenCalled();
    });
  });

});
