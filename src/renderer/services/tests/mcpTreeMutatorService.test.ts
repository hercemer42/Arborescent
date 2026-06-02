import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../store/storeOwnership', () => ({
  findStoreOwningSession: vi.fn(),
}));

import { applyMutation, startMcpTreeMutatorService } from '../mcpTreeMutatorService';
import { findStoreOwningSession } from '../../store/storeOwnership';
import { TreeNode } from '../../../shared/types';
import type { MutationRequest, TreeMutateRequest } from '../../../shared/types/electronApi';

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const SIBLING = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
const GRANDCHILD = 'dddddddd-dddd-dddd-dddd-dddddddddd04';

interface TestState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  actions?: { autoSave?: () => void };
}

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

function makeState(): TestState {
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [BOUND, SIBLING]),
      [BOUND]: makeNode(BOUND, 'Bound', [GRANDCHILD], { note: 'keep-me' }),
      [SIBLING]: makeNode(SIBLING, 'Sibling', []),
      [GRANDCHILD]: makeNode(GRANDCHILD, 'Grandchild', []),
    },
    rootNodeId: ROOT,
    ancestorRegistry: {
      [ROOT]: [],
      [BOUND]: [ROOT],
      [SIBLING]: [ROOT],
      [GRANDCHILD]: [BOUND, ROOT],
    },
  };
}

function makeFakeStore(): { store: { getState(): TestState; setState(partial: Partial<TestState>): void }; getCurrent: () => TestState; autoSave: ReturnType<typeof vi.fn> } {
  const autoSave = vi.fn();
  let state: TestState = { ...makeState(), actions: { autoSave } };
  return {
    store: {
      getState: () => state,
      setState: (partial: Partial<TestState>) => {
        state = { ...state, ...partial };
      },
    },
    getCurrent: () => state,
    autoSave,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyAs(store: any, nodeId: string, request: MutationRequest) {
  return applyMutation(store, nodeId, request);
}

describe('startMcpTreeMutatorService — file-scoped resolution (Ticket A, write path)', () => {
  const ownerOf = findStoreOwningSession as unknown as Mock;

  function captureHandler(): (req: TreeMutateRequest) => void {
    let handler!: (req: TreeMutateRequest) => void;
    (window.electron.onMcpTreeMutateRequest as unknown as Mock).mockImplementation(
      (cb: (req: TreeMutateRequest) => void) => {
        handler = cb;
        return () => {};
      },
    );
    startMcpTreeMutatorService();
    return handler;
  }

  beforeEach(() => {
    ownerOf.mockReset();
    (window.electron.onMcpTreeMutateRequest as unknown as Mock).mockReturnValue(vi.fn());
    (window.electron.respondToMcpTreeMutate as unknown as Mock).mockResolvedValue(undefined);
  });

  it('mutates the store that owns the session, resolved by sessionId not by sweeping', () => {
    const { store, getCurrent } = makeFakeStore();
    ownerOf.mockReturnValue(store);

    const handler = captureHandler();
    handler({ requestId: 'r1', sessionId: 'sess-1', nodeId: BOUND, request: { kind: 'set-content', content: 'scoped' } });

    expect(ownerOf).toHaveBeenCalledWith('sess-1');
    expect(getCurrent().nodes[BOUND].content).toBe('scoped');
    expect(window.electron.respondToMcpTreeMutate).toHaveBeenCalledWith({
      requestId: 'r1',
      result: { ok: true },
    });
  });

  it('fails closed when no open file owns the session', () => {
    ownerOf.mockReturnValue(null);

    const handler = captureHandler();
    handler({ requestId: 'r2', sessionId: 'sess-unknown', nodeId: BOUND, request: { kind: 'set-content', content: 'x' } });

    expect(window.electron.respondToMcpTreeMutate).toHaveBeenCalledWith({
      requestId: 'r2',
      result: { ok: false, error: expect.stringContaining('No open file owns session') },
    });
  });
});

describe('applyMutation — add-child', () => {
  it('appends a new node under the given parent, sets status=pending, and updates ancestorRegistry', () => {
    const { store, getCurrent } = makeFakeStore();
    const result = applyAs(store, BOUND, { kind: 'add-child', parentId: BOUND, content: 'new child' });
    expect(result).toEqual({ ok: true });
    const after = getCurrent();
    const newChildId = after.nodes[BOUND].children[after.nodes[BOUND].children.length - 1];
    expect(newChildId).not.toBe(GRANDCHILD);
    expect(after.nodes[newChildId].content).toBe('new child');
    expect(after.nodes[newChildId].children).toEqual([]);
    expect(after.nodes[newChildId].metadata.status).toBe('pending');
    expect(after.ancestorRegistry[newChildId]).toEqual([ROOT, BOUND]);
  });

  it('respects an explicit position when inserting the new child', () => {
    const { store, getCurrent } = makeFakeStore();
    applyAs(store, BOUND, { kind: 'add-child', parentId: BOUND, content: 'inserted-first', position: 0 });
    const after = getCurrent();
    const firstChildId = after.nodes[BOUND].children[0];
    expect(after.nodes[firstChildId].content).toBe('inserted-first');
  });

  it('inherits isBlueprint=true when adding a child under a workflow parent', () => {
    const { store, getCurrent } = makeFakeStore();
    // shouldInheritBlueprint requires the parent to be a context-declaration,
    // a workflow, or a context-child. Mark BOUND as a workflow so the new child
    // gets isBlueprint=true automatically — mirrors CreateNodeCommand behavior.
    store.setState({
      nodes: {
        ...store.getState().nodes,
        [BOUND]: {
          ...store.getState().nodes[BOUND],
          metadata: { ...store.getState().nodes[BOUND].metadata, isWorkflow: true },
        },
      },
    });
    applyAs(store, BOUND, { kind: 'add-child', parentId: BOUND, content: 'child' });
    const after = getCurrent();
    const newChildId = after.nodes[BOUND].children[after.nodes[BOUND].children.length - 1];
    expect(after.nodes[newChildId].metadata.isBlueprint).toBe(true);
  });

  it('errors when the parent does not exist', () => {
    const { store } = makeFakeStore();
    const result = applyAs(store, BOUND, { kind: 'add-child', parentId: 'nope', content: 'x' });
    expect(result).toEqual({ ok: false, error: expect.stringContaining('not found') });
  });

  it('triggers autoSave on success', () => {
    const { store, autoSave } = makeFakeStore();
    applyAs(store, BOUND, { kind: 'add-child', parentId: BOUND, content: 'x' });
    expect(autoSave).toHaveBeenCalledTimes(1);
  });
});

describe('applyMutation — append', () => {
  it('concatenates content onto the existing node content', () => {
    const { store, getCurrent } = makeFakeStore();
    applyAs(store, BOUND, { kind: 'append', content: ' more' });
    expect(getCurrent().nodes[BOUND].content).toBe('Bound more');
  });

  it('errors when the node does not exist', () => {
    const { store } = makeFakeStore();
    const result = applyAs(store, 'nope', { kind: 'append', content: 'x' });
    expect(result.ok).toBe(false);
  });
});

describe('applyMutation — mark-complete', () => {
  it('sets metadata.status to completed', () => {
    const { store, getCurrent } = makeFakeStore();
    applyAs(store, BOUND, { kind: 'mark-complete', status: 'completed' });
    expect(getCurrent().nodes[BOUND].metadata.status).toBe('completed');
  });

  it('sets metadata.status to abandoned', () => {
    const { store, getCurrent } = makeFakeStore();
    applyAs(store, BOUND, { kind: 'mark-complete', status: 'abandoned' });
    expect(getCurrent().nodes[BOUND].metadata.status).toBe('abandoned');
  });

  it('preserves other metadata keys (e.g., note)', () => {
    const { store, getCurrent } = makeFakeStore();
    applyAs(store, BOUND, { kind: 'mark-complete', status: 'completed' });
    expect(getCurrent().nodes[BOUND].metadata.note).toBe('keep-me');
  });
});

describe('applyMutation — set-content', () => {
  it('replaces the node content', () => {
    const { store, getCurrent } = makeFakeStore();
    applyAs(store, BOUND, { kind: 'set-content', content: 'replaced' });
    expect(getCurrent().nodes[BOUND].content).toBe('replaced');
  });
});

describe('applyMutation — delete', () => {
  it('removes the node from its parent children and from the nodes map (including descendants)', () => {
    const { store, getCurrent } = makeFakeStore();
    applyAs(store, BOUND, { kind: 'delete' });
    const after = getCurrent();
    expect(after.nodes[BOUND]).toBeUndefined();
    expect(after.nodes[GRANDCHILD]).toBeUndefined();
    expect(after.nodes[ROOT].children).not.toContain(BOUND);
  });

  it('refuses to delete the root node', () => {
    const { store } = makeFakeStore();
    const result = applyAs(store, ROOT, { kind: 'delete' });
    expect(result).toEqual({ ok: false, error: expect.stringContaining('root') });
  });

  it('updates ancestorRegistry to drop the deleted node and its descendants', () => {
    const { store, getCurrent } = makeFakeStore();
    applyAs(store, BOUND, { kind: 'delete' });
    const after = getCurrent();
    expect(after.ancestorRegistry[BOUND]).toBeUndefined();
    expect(after.ancestorRegistry[GRANDCHILD]).toBeUndefined();
  });
});

describe('applyMutation — move', () => {
  it('moves the node under a new parent and updates ancestorRegistry recursively', () => {
    const { store, getCurrent } = makeFakeStore();
    applyAs(store, BOUND, { kind: 'move', newParentId: SIBLING });
    const after = getCurrent();
    expect(after.nodes[ROOT].children).not.toContain(BOUND);
    expect(after.nodes[SIBLING].children).toContain(BOUND);
    expect(after.ancestorRegistry[BOUND]).toEqual([ROOT, SIBLING]);
    expect(after.ancestorRegistry[GRANDCHILD]).toEqual([ROOT, SIBLING, BOUND]);
  });

  it('respects an explicit position', () => {
    const { store, getCurrent } = makeFakeStore();
    // Add a third child to SIBLING first so we can pick a non-end position
    applyAs(store, SIBLING, { kind: 'add-child', parentId: SIBLING, content: 'first-child' });
    applyAs(store, BOUND, { kind: 'move', newParentId: SIBLING, position: 0 });
    expect(getCurrent().nodes[SIBLING].children[0]).toBe(BOUND);
  });

  it('refuses to move the root node', () => {
    const { store } = makeFakeStore();
    const result = applyAs(store, ROOT, { kind: 'move', newParentId: SIBLING });
    expect(result.ok).toBe(false);
  });

  it('refuses to move a node into itself', () => {
    const { store } = makeFakeStore();
    const result = applyAs(store, BOUND, { kind: 'move', newParentId: BOUND });
    expect(result.ok).toBe(false);
  });

  it('refuses to move a node into its own descendant', () => {
    const { store } = makeFakeStore();
    const result = applyAs(store, BOUND, { kind: 'move', newParentId: GRANDCHILD });
    expect(result).toEqual({ ok: false, error: expect.stringContaining('descendant') });
  });

  it('errors when the new parent does not exist', () => {
    const { store } = makeFakeStore();
    const result = applyAs(store, BOUND, { kind: 'move', newParentId: 'nope' });
    expect(result.ok).toBe(false);
  });

  it('reorders within the same parent without duplicating the node', () => {
    // Regression test: capturing the parent snapshot before filtering the old parent
    // caused the moved node to be re-added without being removed when
    // oldParentId === newParentId. The node would then appear twice under the parent.
    const { store, getCurrent } = makeFakeStore();
    // ROOT has [BOUND, SIBLING]; move SIBLING to position 0 within ROOT
    const result = applyAs(store, SIBLING, { kind: 'move', newParentId: ROOT, position: 0 });
    expect(result).toEqual({ ok: true });
    const children = getCurrent().nodes[ROOT].children;
    expect(children).toEqual([SIBLING, BOUND]);
    expect(children.filter((id) => id === SIBLING)).toHaveLength(1);
  });
});

describe('applyMutation — set-metadata', () => {
  it('sets a new metadata key without disturbing others', () => {
    const { store, getCurrent } = makeFakeStore();
    applyAs(store, BOUND, { kind: 'set-metadata', key: 'custom', value: 42 });
    const after = getCurrent().nodes[BOUND];
    expect(after.metadata.custom).toBe(42);
    expect(after.metadata.note).toBe('keep-me');
  });

  it('overwrites an existing metadata key', () => {
    const { store, getCurrent } = makeFakeStore();
    applyAs(store, BOUND, { kind: 'set-metadata', key: 'note', value: 'changed' });
    expect(getCurrent().nodes[BOUND].metadata.note).toBe('changed');
  });

  it('accepts complex (object) values', () => {
    const { store, getCurrent } = makeFakeStore();
    const complex = { nested: { value: [1, 2, 3] } };
    applyAs(store, BOUND, { kind: 'set-metadata', key: 'data', value: complex });
    expect(getCurrent().nodes[BOUND].metadata.data).toEqual(complex);
  });
});

describe('applyMutation — autoSave', () => {
  it('triggers autoSave on every successful mutation kind', () => {
    const { store, autoSave } = makeFakeStore();
    applyAs(store, BOUND, { kind: 'append', content: 'x' });
    applyAs(store, BOUND, { kind: 'set-content', content: 'y' });
    applyAs(store, BOUND, { kind: 'mark-complete', status: 'completed' });
    applyAs(store, BOUND, { kind: 'set-metadata', key: 'k', value: 'v' });
    expect(autoSave).toHaveBeenCalledTimes(4);
  });

  it('does not call autoSave when the mutation fails', () => {
    const { store, autoSave } = makeFakeStore();
    applyAs(store, 'nope', { kind: 'append', content: 'x' });
    expect(autoSave).not.toHaveBeenCalled();
  });
});
