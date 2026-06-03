import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNodeDeletionActions } from '../nodeDeletionActions';
import { DeleteNodeCommand } from '../../commands/DeleteNodeCommand';
import { DeleteMultipleNodesCommand } from '../../commands/DeleteMultipleNodesCommand';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../../../utils/ancestry';

// The deleteNodes(ids[]) core unifies the side-effect sequence (descendant capture →
// session-binding collection → step-deletion capture → command → disruption notification →
// binding release) so the single- and multi-node entry points cannot drift apart again.
// Routing is by arity: one id keeps DeleteNodeCommand (step history, zoom tabs), several
// ids keep DeleteMultipleNodesCommand (atomic undo, position-DESC restore).

type TestState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  workflowSessionMap: Record<string, string>;
  activeNodeId?: string | null;
  cursorPosition?: number;
  multiSelectedNodeIds?: Set<string>;
  actions?: {
    executeCommand?: (cmd: unknown) => void;
    handleNodeDeleted?: (nodeId: string) => void;
    handleStepDeleted?: (stepId: string) => void;
    handleAllStepsRemoved?: (workflowId: string) => void;
  };
};

type DeleteNodesCore = { deleteNodes(ids: string[]): void };

function node(id: string, children: string[], metadata: Record<string, unknown> = {}): TreeNode {
  return { id, content: id, children, metadata: { status: 'pending', ...metadata } };
}

function clearSessionBindingsMock() {
  return vi.mocked(window.electron.clearSessionBindings);
}

describe('nodeDeletionActions — deleteNodes(ids[]) core', () => {
  let state: TestState;
  let actions: ReturnType<typeof createNodeDeletionActions>;
  let mockExecuteCommand: ReturnType<typeof vi.fn>;
  let handleNodeDeleted: ReturnType<typeof vi.fn>;
  let handleStepDeleted: ReturnType<typeof vi.fn>;
  let handleAllStepsRemoved: ReturnType<typeof vi.fn>;

  function deleteNodes(ids: string[]): void {
    (actions as unknown as DeleteNodesCore).deleteNodes(ids);
  }

  function executedCommands(): unknown[] {
    return mockExecuteCommand.mock.calls.map((call) => call[0]);
  }

  function build(partial: Partial<TestState>): void {
    mockExecuteCommand = vi.fn((command: { execute: () => void }) => command.execute());
    handleNodeDeleted = vi.fn();
    handleStepDeleted = vi.fn();
    handleAllStepsRemoved = vi.fn();
    state = {
      rootNodeId: 'root',
      workflowSessionMap: {},
      multiSelectedNodeIds: new Set(),
      ...partial,
    } as TestState;
    const setState = (p: Partial<TestState>) => {
      state = { ...state, ...p };
    };
    actions = createNodeDeletionActions(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => state as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState as any,
      undefined,
      mockExecuteCommand,
      {
        handleNodeDeleted,
        handleStepDeleted,
        handleAllStepsRemoved,
      }
    );
  }

  function buildSiblingTree(): void {
    build({
      nodes: {
        root: node('root', ['a', 'b', 'c']),
        a: node('a', ['a1']),
        a1: node('a1', []),
        b: node('b', []),
        c: node('c', []),
      },
      ancestorRegistry: { root: [], a: ['root'], a1: ['root', 'a'], b: ['root'], c: ['root'] },
    });
  }

  beforeEach(() => {
    clearSessionBindingsMock().mockClear();
  });

  describe('arity routing', () => {
    it('routes a single id to DeleteNodeCommand', () => {
      buildSiblingTree();

      deleteNodes(['b']);

      expect(executedCommands()).toHaveLength(1);
      expect(executedCommands()[0]).toBeInstanceOf(DeleteNodeCommand);
      expect(state.nodes['b']).toBeUndefined();
    });

    it('routes multiple ids to a single DeleteMultipleNodesCommand', () => {
      buildSiblingTree();

      deleteNodes(['b', 'c']);

      expect(executedCommands()).toHaveLength(1);
      expect(executedCommands()[0]).toBeInstanceOf(DeleteMultipleNodesCommand);
    });

    it('never fragments a multi-delete into per-id commands', () => {
      buildSiblingTree();

      deleteNodes(['a', 'b', 'c']);

      expect(mockExecuteCommand).toHaveBeenCalledTimes(1);
    });
  });

  describe('deletion behavior', () => {
    it('deletes all listed nodes and their descendants', () => {
      buildSiblingTree();

      deleteNodes(['a', 'b']);

      expect(state.nodes['a']).toBeUndefined();
      expect(state.nodes['a1']).toBeUndefined();
      expect(state.nodes['b']).toBeUndefined();
      expect(state.nodes['c']).toBeDefined();
      expect(state.nodes['root'].children).toEqual(['c']);
    });

    it('assumes confirmation already happened — deletes a parent with children without a prompt protocol', () => {
      buildSiblingTree();

      deleteNodes(['a']);

      expect(state.nodes['a']).toBeUndefined();
      expect(state.nodes['a1']).toBeUndefined();
    });

    it('clears multiSelectedNodeIds after a multi-delete', () => {
      buildSiblingTree();
      state.multiSelectedNodeIds = new Set(['b', 'c']);

      deleteNodes(['b', 'c']);

      expect(state.multiSelectedNodeIds?.size).toBe(0);
    });

    it('is a no-op for an empty id list', () => {
      buildSiblingTree();

      deleteNodes([]);

      expect(mockExecuteCommand).not.toHaveBeenCalled();
      expect(handleNodeDeleted).not.toHaveBeenCalled();
      expect(state.nodes['root'].children).toEqual(['a', 'b', 'c']);
    });

    it.todo('defines behavior for ids that do not exist in the tree (skip vs delete the rest)');

    it.todo('defines one state-read convention (live getters vs frozen snapshot) when the tree mutates between invocation and command execution');
  });

  describe('side-effect equivalence between arities', () => {
    function buildBoundTree(): void {
      build({
        nodes: {
          root: node('root', ['p', 'q', 'plain']),
          p: node('p', ['p1'], { sessionId: 'sess-p' }),
          p1: node('p1', [], { sessionId: 'sess-p1' }),
          q: node('q', [], { sessionId: 'sess-q' }),
          plain: node('plain', []),
        },
        ancestorRegistry: { root: [], p: ['root'], p1: ['root', 'p'], q: ['root'], plain: ['root'] },
        workflowSessionMap: { 'sess-p': 't1', 'sess-p1': 't2', 'sess-q': 't3' },
      });
    }

    function sessionsCleared(): string[] {
      return clearSessionBindingsMock()
        .mock.calls.flatMap((call) => [...(call[0] as string[])])
        .sort();
    }

    it('releases bindings for node and descendants on the single-id arity', () => {
      buildBoundTree();

      deleteNodes(['p']);

      expect(sessionsCleared()).toEqual(['sess-p', 'sess-p1']);
      expect(state.workflowSessionMap).toEqual({ 'sess-q': 't3' });
    });

    it('releases bindings for every node and descendant on the multi-id arity', () => {
      buildBoundTree();

      deleteNodes(['p', 'q']);

      expect(sessionsCleared()).toEqual(['sess-p', 'sess-p1', 'sess-q']);
      expect(state.workflowSessionMap).toEqual({});
    });

    it('releases each binding exactly once', () => {
      buildBoundTree();

      deleteNodes(['p', 'q']);

      const cleared = clearSessionBindingsMock().mock.calls.flatMap((call) => [...(call[0] as string[])]);
      expect(cleared).toHaveLength(new Set(cleared).size);
    });

    it('notifies handleNodeDeleted for every deleted id including descendants, on both arities', () => {
      buildBoundTree();

      deleteNodes(['p']);
      const singleArityIds = handleNodeDeleted.mock.calls.map((c) => c[0]).sort();
      expect(singleArityIds).toEqual(['p', 'p1']);

      handleNodeDeleted.mockClear();
      deleteNodes(['q', 'plain']);
      const multiArityIds = handleNodeDeleted.mock.calls.map((c) => c[0]).sort();
      expect(multiArityIds).toEqual(['plain', 'q']);
    });
  });

  describe('workflow step disruption', () => {
    function buildWorkflowTree(extraStep = false): void {
      const steps = extraStep ? ['step-1', 'step-2'] : ['step-1'];
      const nodes: Record<string, TreeNode> = {
        root: node('root', ['wf', 'plain']),
        wf: node('wf', [...steps], { isWorkflow: true }),
        'step-1': node('step-1', []),
        plain: node('plain', []),
      };
      const ancestorRegistry: AncestorRegistry = {
        root: [],
        wf: ['root'],
        'step-1': ['root', 'wf'],
        plain: ['root'],
      };
      if (extraStep) {
        nodes['step-2'] = node('step-2', []);
        ancestorRegistry['step-2'] = ['root', 'wf'];
      }
      build({ nodes, ancestorRegistry });
    }

    it('fires handleStepDeleted for a workflow step on the single-id arity', () => {
      buildWorkflowTree(true);

      deleteNodes(['step-1']);

      expect(handleStepDeleted).toHaveBeenCalledWith('step-1');
      expect(handleAllStepsRemoved).not.toHaveBeenCalled();
    });

    it('fires handleStepDeleted per step and handleAllStepsRemoved when the workflow empties, on the multi-id arity', () => {
      buildWorkflowTree(true);

      deleteNodes(['step-1', 'step-2']);

      expect(handleStepDeleted).toHaveBeenCalledWith('step-1');
      expect(handleStepDeleted).toHaveBeenCalledWith('step-2');
      expect(handleAllStepsRemoved).toHaveBeenCalledWith('wf');
    });

    it('fires handleAllStepsRemoved when the single-id arity removes the last step', () => {
      buildWorkflowTree(false);

      deleteNodes(['step-1']);

      expect(handleStepDeleted).toHaveBeenCalledWith('step-1');
      expect(handleAllStepsRemoved).toHaveBeenCalledWith('wf');
    });
  });

  describe('wrapper equivalence', () => {
    it('deleteNode(id) and deleteNodes([id]) produce identical binding cleanup', () => {
      const boundNodes = () => ({
        nodes: {
          root: node('root', ['bound', 'plain']),
          bound: node('bound', [], { sessionId: 'sess-bound' }),
          plain: node('plain', []),
        },
        ancestorRegistry: { root: [], bound: ['root'], plain: ['root'] } as AncestorRegistry,
        workflowSessionMap: { 'sess-bound': 'term-1' },
      });

      build(boundNodes());
      actions.deleteNode('bound');
      const viaWrapper = clearSessionBindingsMock().mock.calls.map((c) => c[0]);

      clearSessionBindingsMock().mockClear();
      build(boundNodes());
      deleteNodes(['bound']);
      const viaCore = clearSessionBindingsMock().mock.calls.map((c) => c[0]);

      expect(viaCore).toEqual(viaWrapper);
    });
  });
});
