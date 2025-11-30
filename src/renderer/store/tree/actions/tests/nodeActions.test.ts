import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNodeActions } from '../nodeActions';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../../../services/ancestry';

describe('nodeActions', () => {
  type TestState = {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: AncestorRegistry;
    activeNodeId: string | null;
    cursorPosition: number;
    rememberedVisualX: number | null;
    collaboratingNodeId: string | null;
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
});
