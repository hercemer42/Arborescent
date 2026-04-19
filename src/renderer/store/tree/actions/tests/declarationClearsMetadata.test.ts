import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createBlueprintActions } from '../blueprintActions';
import { createContextActions } from '../contextActions';
import { createWorkflowActions } from '../workflowActions';
import type { TreeNode } from '@shared/types';

// These tests pin the desired behavior:
// declaring a node as a blueprint, context, or workflow strips its
// task-state metadata (status, resolvedAt, feedbackTempFile, applied
// context fields) on the directly-declared node only — never on
// descendants. Undo restores everything.

vi.mock('../../../services/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../../toast/toastStore', () => ({
  useToastStore: { getState: () => ({ addToast: vi.fn() }) },
}));

interface TestState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  contextDeclarations: { nodeId: string; content: string; icon: string; mode: 'collaborate' | 'execute' }[];
  blueprintModeEnabled: boolean;
  isFileBlueprintFile: boolean;
  activeNodeId: string | null;
  summaryModeEnabled: boolean;
}

function makeBaseState(): TestState {
  return {
    nodes: {
      'root': {
        id: 'root',
        content: 'Root',
        children: ['parent'],
        metadata: { isBlueprint: true },
      },
      'parent': {
        id: 'parent',
        content: 'Parent (already a blueprint so children can be declared as context)',
        children: ['target', 'sibling'],
        metadata: {
          isBlueprint: true,
          status: 'pending',
        },
      },
      'target': {
        id: 'target',
        content: 'Target node — was completed before being declared as something structural',
        children: ['leaf'],
        metadata: {
          status: 'completed',
          resolvedAt: '2026-04-19T10:00:00Z',
          feedbackTempFile: '/tmp/feedback-target.arbo',
          appliedContextId: 'some-ctx',
          appliedContextIds: ['some-ctx'],
          activeContextId: 'some-ctx',
          created: '2026-01-01T00:00:00Z',
          updated: '2026-04-18T00:00:00Z',
          expanded: true,
          plugins: { foo: { setting: 'bar' } },
        },
      },
      'leaf': {
        id: 'leaf',
        content: 'Completed descendant of target',
        children: [],
        metadata: {
          status: 'completed',
          resolvedAt: '2026-04-19T09:00:00Z',
        },
      },
      'sibling': {
        id: 'sibling',
        content: 'Untouched sibling',
        children: [],
        metadata: { status: 'pending' },
      },
    },
    rootNodeId: 'root',
    ancestorRegistry: {
      'root': [],
      'parent': ['root'],
      'target': ['parent', 'root'],
      'leaf': ['target', 'parent', 'root'],
      'sibling': ['parent', 'root'],
    },
    contextDeclarations: [],
    blueprintModeEnabled: false,
    isFileBlueprintFile: false,
    activeNodeId: 'target',
    summaryModeEnabled: false,
  };
}

describe('declaring a node clears its task metadata', () => {
  let state: TestState;
  let setState: (partial: Partial<TestState> | ((s: TestState) => Partial<TestState>)) => void;
  let executeCommand: ReturnType<typeof vi.fn>;
  let lastCommand: { execute: () => void; undo: () => void } | null;

  beforeEach(() => {
    state = makeBaseState();
    setState = (partial) => {
      const next = typeof partial === 'function' ? partial(state) : partial;
      state = { ...state, ...next };
    };
    lastCommand = null;
    executeCommand = vi.fn((command) => {
      lastCommand = command;
      command.execute();
    });
  });

  describe('addToBlueprint', () => {
    let actions: ReturnType<typeof createBlueprintActions>;

    beforeEach(() => {
      // sibling is the candidate — not yet a blueprint
      // give it the same task metadata as 'target'
      state.nodes.sibling = {
        ...state.nodes.sibling,
        metadata: {
          status: 'completed',
          resolvedAt: '2026-04-19T10:00:00Z',
          feedbackTempFile: '/tmp/feedback-sibling.arbo',
          appliedContextId: 'some-ctx',
          expanded: true,
        },
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actions = createBlueprintActions(() => state as any, setState as any, vi.fn(), executeCommand);
    });

    it('clears status, resolvedAt, feedbackTempFile, appliedContextId on the directly-declared node', () => {
      actions.addToBlueprint('sibling');

      const meta = state.nodes.sibling.metadata;
      expect(meta.isBlueprint).toBe(true);
      expect(meta.status).toBeUndefined();
      expect(meta.resolvedAt).toBeUndefined();
      expect(meta.feedbackTempFile).toBeUndefined();
      expect(meta.appliedContextId).toBeUndefined();
    });

    it('preserves expanded, created, updated, and plugins on the directly-declared node', () => {
      state.nodes.sibling.metadata = {
        ...state.nodes.sibling.metadata,
        created: '2026-01-01T00:00:00Z',
        updated: '2026-04-18T00:00:00Z',
        plugins: { foo: { x: 1 } },
      };

      actions.addToBlueprint('sibling');

      const meta = state.nodes.sibling.metadata;
      expect(meta.expanded).toBe(true);
      expect(meta.created).toBe('2026-01-01T00:00:00Z');
      expect(meta.updated).toBe('2026-04-18T00:00:00Z');
      expect(meta.plugins).toEqual({ foo: { x: 1 } });
    });

    it('does NOT clear status on cascaded descendants (cascade only sets isBlueprint)', () => {
      // Setup: sibling has a child with completed status
      state.nodes['sibling-child'] = {
        id: 'sibling-child',
        content: 'Completed child',
        children: [],
        metadata: { status: 'completed', resolvedAt: '2026-04-18T00:00:00Z' },
      };
      state.nodes.sibling = {
        ...state.nodes.sibling,
        children: ['sibling-child'],
      };
      state.ancestorRegistry['sibling-child'] = ['sibling', 'parent', 'root'];

      actions.addToBlueprint('sibling', true);

      const childMeta = state.nodes['sibling-child'].metadata;
      expect(childMeta.isBlueprint).toBe(true);
      expect(childMeta.status).toBe('completed');
      expect(childMeta.resolvedAt).toBe('2026-04-18T00:00:00Z');
    });

    it('undo restores all cleared fields on the directly-declared node', () => {
      const beforeMeta = { ...state.nodes.sibling.metadata };

      actions.addToBlueprint('sibling');
      lastCommand?.undo();

      expect(state.nodes.sibling.metadata).toEqual(beforeMeta);
    });

    it('does not touch the sibling node that was not declared', () => {
      const otherBefore = { ...state.nodes.target.metadata };
      actions.addToBlueprint('sibling');
      expect(state.nodes.target.metadata).toEqual(otherBefore);
    });
  });

  describe('declareAsContext', () => {
    let actions: ReturnType<typeof createContextActions>;

    beforeEach(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actions = createContextActions(() => state as any, setState as any, vi.fn(), executeCommand);
    });

    it('clears status, resolvedAt, feedbackTempFile, appliedContextId on the target', () => {
      actions.declareAsContext('target');

      const meta = state.nodes.target.metadata;
      expect(meta.isContextDeclaration).toBe(true);
      expect(meta.status).toBeUndefined();
      expect(meta.resolvedAt).toBeUndefined();
      expect(meta.feedbackTempFile).toBeUndefined();
      expect(meta.appliedContextId).toBeUndefined();
      expect(meta.appliedContextIds).toBeUndefined();
      expect(meta.activeContextId).toBeUndefined();
    });

    it('preserves created, updated, expanded, plugins on the target', () => {
      actions.declareAsContext('target');

      const meta = state.nodes.target.metadata;
      expect(meta.created).toBe('2026-01-01T00:00:00Z');
      expect(meta.updated).toBe('2026-04-18T00:00:00Z');
      expect(meta.expanded).toBe(true);
      expect(meta.plugins).toEqual({ foo: { setting: 'bar' } });
    });

    it('does NOT clear status on the descendant leaf node', () => {
      actions.declareAsContext('target');

      const leafMeta = state.nodes.leaf.metadata;
      expect(leafMeta.status).toBe('completed');
      expect(leafMeta.resolvedAt).toBe('2026-04-19T09:00:00Z');
    });

    it('undo restores all cleared task fields on the target', () => {
      const before = { ...state.nodes.target.metadata };

      actions.declareAsContext('target');
      lastCommand?.undo();

      expect(state.nodes.target.metadata).toEqual(before);
    });
  });

  describe('declareAsWorkflow', () => {
    let actions: ReturnType<typeof createWorkflowActions>;

    beforeEach(() => {
      // workflow declarations operate on a node that has children (the steps)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      actions = createWorkflowActions(() => state as any, setState as any, vi.fn(), executeCommand);
    });

    it('clears status, resolvedAt, feedbackTempFile, appliedContextId on the workflow root', () => {
      actions.declareAsWorkflow('target');

      const meta = state.nodes.target.metadata;
      expect(meta.isWorkflow).toBe(true);
      expect(meta.status).toBeUndefined();
      expect(meta.resolvedAt).toBeUndefined();
      expect(meta.feedbackTempFile).toBeUndefined();
      expect(meta.appliedContextId).toBeUndefined();
    });

    it('preserves expanded, created, updated, plugins on the workflow root', () => {
      actions.declareAsWorkflow('target');

      const meta = state.nodes.target.metadata;
      expect(meta.created).toBe('2026-01-01T00:00:00Z');
      expect(meta.updated).toBe('2026-04-18T00:00:00Z');
      expect(meta.expanded).toBe(true);
      expect(meta.plugins).toEqual({ foo: { setting: 'bar' } });
    });

    it('does NOT clear status on workflow step children', () => {
      actions.declareAsWorkflow('target');
      // 'leaf' is the child of 'target' — gets isBlueprint added but keeps status
      const leafMeta = state.nodes.leaf.metadata;
      expect(leafMeta.status).toBe('completed');
    });

    it('undo restores all cleared task fields on the workflow root', () => {
      const before = { ...state.nodes.target.metadata };

      actions.declareAsWorkflow('target');
      lastCommand?.undo();

      expect(state.nodes.target.metadata).toEqual(before);
    });
  });

  describe('idempotency and edge cases', () => {
    it('declaring an already-declared blueprint a second time does not re-clear (no-op)', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blueprintActions = createBlueprintActions(() => state as any, setState as any, vi.fn(), executeCommand);

      // node-1 stand-in: give 'sibling' an established blueprint state with task fields already gone
      state.nodes.sibling = {
        ...state.nodes.sibling,
        metadata: { isBlueprint: true, expanded: true },
      };

      blueprintActions.addToBlueprint('sibling');

      // No status was added; metadata is unchanged
      expect(state.nodes.sibling.metadata.isBlueprint).toBe(true);
      expect(state.nodes.sibling.metadata.expanded).toBe(true);
      expect(state.nodes.sibling.metadata.status).toBeUndefined();
    });

    it('declaring a node with no task fields leaves the rest untouched', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blueprintActions = createBlueprintActions(() => state as any, setState as any, vi.fn(), executeCommand);

      state.nodes.sibling = {
        ...state.nodes.sibling,
        metadata: { expanded: false, plugins: { p: { x: 1 } } },
      };

      blueprintActions.addToBlueprint('sibling');

      expect(state.nodes.sibling.metadata.isBlueprint).toBe(true);
      expect(state.nodes.sibling.metadata.expanded).toBe(false);
      expect(state.nodes.sibling.metadata.plugins).toEqual({ p: { x: 1 } });
    });

    it('does nothing when the node id does not exist', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const blueprintActions = createBlueprintActions(() => state as any, setState as any, vi.fn(), executeCommand);

      const beforeNodes = { ...state.nodes };
      blueprintActions.addToBlueprint('does-not-exist');
      expect(state.nodes).toEqual(beforeNodes);
    });
  });
});
