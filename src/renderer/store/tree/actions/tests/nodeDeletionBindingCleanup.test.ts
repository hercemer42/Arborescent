import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createNodeDeletionActions } from '../nodeDeletionActions';
import type { TreeNode } from '@shared/types';
import type { AncestorRegistry } from '../../../../utils/ancestry';

// Deleting a node (or any descendant) that carries metadata.sessionId must release
// that binding from both sources of truth: drop it from workflowSessionMap and call
// clearSessionBindings so the main-process registry no longer resolves the session
// to a node that no longer exists.

type TestState = {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: AncestorRegistry;
  workflowSessionMap: Record<string, string>;
  activeNodeId?: string | null;
  cursorPosition?: number;
  actions?: { executeCommand?: (cmd: unknown) => void };
};

function node(id: string, children: string[], sessionId?: string): TreeNode {
  return {
    id,
    content: id,
    children,
    metadata: sessionId ? { status: 'pending', sessionId } : { status: 'pending' },
  };
}

function clearSessionBindingsMock() {
  return vi.mocked(window.electron.clearSessionBindings);
}

function sessionsCleared(): string[] {
  const calls = clearSessionBindingsMock().mock.calls;
  return calls.flatMap((call) => [...(call[0] as string[])]).sort();
}

describe('nodeDeletionActions — session binding cleanup', () => {
  let state: TestState;
  let setState: (partial: Partial<TestState>) => void;
  let actions: ReturnType<typeof createNodeDeletionActions>;

  function build(partial: Partial<TestState>): void {
    const mockExecuteCommand = vi.fn((command: { execute: () => void }) => command.execute());
    state = {
      rootNodeId: 'root',
      workflowSessionMap: {},
      actions: { executeCommand: mockExecuteCommand },
      ...partial,
    } as TestState;
    setState = (p) => {
      state = { ...state, ...p };
    };
    actions = createNodeDeletionActions(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      () => state as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState as any,
    );
  }

  beforeEach(() => {
    clearSessionBindingsMock().mockClear();
  });

  it('releases the deleted node’s session from workflowSessionMap and the registry', () => {
    build({
      nodes: {
        root: node('root', ['bound', 'plain']),
        bound: node('bound', [], 'sess-bound'),
        plain: node('plain', []),
      },
      ancestorRegistry: { root: [], bound: ['root'], plain: ['root'] },
      workflowSessionMap: { 'sess-bound': 'term-1', 'sess-other': 'term-2' },
    });

    actions.deleteNode('bound');

    expect(clearSessionBindingsMock()).toHaveBeenCalledWith(['sess-bound']);
    expect(state.workflowSessionMap).toEqual({ 'sess-other': 'term-2' });
  });

  it('releases a binding carried by a descendant of the deleted subtree', () => {
    build({
      nodes: {
        root: node('root', ['parent', 'plain']),
        parent: node('parent', ['child']),
        child: node('child', [], 'sess-child'),
        plain: node('plain', []),
      },
      ancestorRegistry: { root: [], parent: ['root'], child: ['root', 'parent'], plain: ['root'] },
      workflowSessionMap: { 'sess-child': 'term-1' },
    });

    actions.deleteNode('parent', true);

    expect(clearSessionBindingsMock()).toHaveBeenCalledWith(['sess-child']);
    expect(state.workflowSessionMap).toEqual({});
  });

  it('releases every binding across a multi-bound deleted subtree', () => {
    build({
      nodes: {
        root: node('root', ['parent', 'plain']),
        parent: node('parent', ['c1', 'c2'], 'sess-p'),
        c1: node('c1', [], 'sess-a'),
        c2: node('c2', [], 'sess-b'),
        plain: node('plain', []),
      },
      ancestorRegistry: {
        root: [],
        parent: ['root'],
        c1: ['root', 'parent'],
        c2: ['root', 'parent'],
        plain: ['root'],
      },
      workflowSessionMap: { 'sess-p': 't1', 'sess-a': 't2', 'sess-b': 't3' },
    });

    actions.deleteNode('parent', true);

    expect(sessionsCleared()).toEqual(['sess-a', 'sess-b', 'sess-p']);
    expect(state.workflowSessionMap).toEqual({});
  });

  it('does not touch bindings when the deleted node carries no session', () => {
    build({
      nodes: {
        root: node('root', ['plain', 'keep']),
        plain: node('plain', []),
        keep: node('keep', []),
      },
      ancestorRegistry: { root: [], plain: ['root'], keep: ['root'] },
      workflowSessionMap: { 'sess-other': 'term-2' },
    });

    actions.deleteNode('plain');

    expect(clearSessionBindingsMock()).not.toHaveBeenCalled();
    expect(state.workflowSessionMap).toEqual({ 'sess-other': 'term-2' });
  });

  it('unregisters the registry binding even when the session is not in workflowSessionMap', () => {
    build({
      nodes: {
        root: node('root', ['bound', 'plain']),
        bound: node('bound', [], 'sess-orphan'),
        plain: node('plain', []),
      },
      ancestorRegistry: { root: [], bound: ['root'], plain: ['root'] },
      workflowSessionMap: {},
    });

    actions.deleteNode('bound');

    expect(clearSessionBindingsMock()).toHaveBeenCalledWith(['sess-orphan']);
  });

  it('does not release the binding when the node is kept (last root-level node clears content)', () => {
    build({
      nodes: {
        root: node('root', ['only-child']),
        'only-child': node('only-child', [], 'sess-kept'),
      },
      ancestorRegistry: { root: [], 'only-child': ['root'] },
      workflowSessionMap: { 'sess-kept': 'term-1' },
    });

    actions.deleteNode('only-child');

    expect(state.nodes['only-child']).toBeDefined();
    expect(clearSessionBindingsMock()).not.toHaveBeenCalled();
    expect(state.workflowSessionMap).toEqual({ 'sess-kept': 'term-1' });
  });

  it('does not release the binding when deletion is declined (has children, not confirmed)', () => {
    build({
      nodes: {
        root: node('root', ['parent', 'sib']),
        parent: node('parent', ['child'], 'sess-parent'),
        child: node('child', []),
        sib: node('sib', []),
      },
      ancestorRegistry: { root: [], parent: ['root'], child: ['root', 'parent'], sib: ['root'] },
      workflowSessionMap: { 'sess-parent': 'term-1' },
    });

    const result = actions.deleteNode('parent');

    expect(result).toBe(false);
    expect(state.nodes['parent']).toBeDefined();
    expect(clearSessionBindingsMock()).not.toHaveBeenCalled();
    expect(state.workflowSessionMap).toEqual({ 'sess-parent': 'term-1' });
  });
});
