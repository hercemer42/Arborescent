import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import { createReadTools, ReadTools, TreeReadState } from '../mcpReadTools';
import { TreeNode } from '../../../shared/types';

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const CHILD_A = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const CHILD_B = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
const GRANDCHILD = 'dddddddd-dddd-dddd-dddd-dddddddddd04';
const CTX_COLLAB = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05';
const CTX_EXEC = 'ffffffff-ffff-ffff-ffff-ffffffffff06';

function makeNode(
  id: string,
  content: string,
  children: string[] = [],
  metadata: TreeNode['metadata'] = {}
): TreeNode {
  return { id, content, children, metadata };
}

function makeState(overrides: Partial<TreeReadState> = {}): TreeReadState {
  const nodes: Record<string, TreeNode> = {
    [ROOT]: makeNode(ROOT, 'Root', [CHILD_A, CHILD_B, CTX_COLLAB, CTX_EXEC]),
    [CHILD_A]: makeNode(CHILD_A, 'Child A', [GRANDCHILD], { appliedContextId: CTX_COLLAB }),
    [CHILD_B]: makeNode(CHILD_B, 'Child B', []),
    [GRANDCHILD]: makeNode(GRANDCHILD, 'Grandchild', []),
    [CTX_COLLAB]: makeNode(CTX_COLLAB, 'Collaborate ctx', [], {
      isContextDeclaration: true,
      collaborate: true,
      execute: false,
    }),
    [CTX_EXEC]: makeNode(CTX_EXEC, 'Execute ctx', [], {
      isContextDeclaration: true,
      collaborate: false,
      execute: true,
    }),
  };
  return {
    nodes,
    rootNodeId: ROOT,
    ancestorRegistry: {
      [ROOT]: [],
      [CHILD_A]: [ROOT],
      [CHILD_B]: [ROOT],
      [GRANDCHILD]: [CHILD_A, ROOT],
      [CTX_COLLAB]: [ROOT],
      [CTX_EXEC]: [ROOT],
    },
    ...overrides,
  };
}

function makeDeps(initialState: TreeReadState | null = makeState()) {
  let state = initialState;
  const registry = new SessionBindingRegistry();
  return {
    registry,
    setState: (next: TreeReadState | null) => { state = next; },
    deps: {
      bindingRegistry: registry,
      treeReader: { readState: vi.fn(async () => state) },
    },
  };
}

describe('createReadTools — get_node', () => {
  let registry: SessionBindingRegistry;
  let tools: ReadTools;
  let setState: (next: TreeReadState | null) => void;

  beforeEach(() => {
    const made = makeDeps();
    registry = made.registry;
    setState = made.setState;
    tools = createReadTools(made.deps);
  });

  it('returns content, metadata, and the effective mode for the bound step', async () => {
    registry.register('sess-1', CHILD_A);

    const result = await tools.getNode({ sessionId: 'sess-1' });

    expect(result.isError).toBeFalsy();
    const text = result.content[0].text;
    const payload = JSON.parse(text);
    expect(payload).toMatchObject({
      id: CHILD_A,
      content: 'Child A',
      metadata: expect.objectContaining({ appliedContextId: CTX_COLLAB }),
      mode: { collaborate: true, execute: false, label: 'collaborate' },
    });
  });

  it('returns a descriptive error when the calling session has no binding', async () => {
    const result = await tools.getNode({ sessionId: 'unknown-session' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/no binding|not bound/i);
  });

  it('returns a descriptive error when the bound node is no longer in the tree', async () => {
    registry.register('sess-1', 'orphan-node-id');

    const result = await tools.getNode({ sessionId: 'sess-1' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not found|orphan/i);
  });

  it('returns a descriptive error when the renderer tree state is unavailable', async () => {
    registry.register('sess-1', CHILD_A);
    setState(null);

    const result = await tools.getNode({ sessionId: 'sess-1' });

    expect(result.isError).toBe(true);
  });
});

describe('createReadTools — get_tree', () => {
  let registry: SessionBindingRegistry;
  let tools: ReadTools;

  beforeEach(() => {
    const made = makeDeps();
    registry = made.registry;
    tools = createReadTools(made.deps);
  });

  it('returns the tree from the bound node when no depth is specified', async () => {
    registry.register('sess-1', CHILD_A);

    const result = await tools.getTree({ sessionId: 'sess-1' });

    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.id).toBe(CHILD_A);
    expect(payload.children).toHaveLength(1);
    expect(payload.children[0].id).toBe(GRANDCHILD);
  });

  it('depth=0 returns just the bound node with no children', async () => {
    registry.register('sess-1', CHILD_A);

    const result = await tools.getTree({ sessionId: 'sess-1', depth: 0 });

    const payload = JSON.parse(result.content[0].text);
    expect(payload.id).toBe(CHILD_A);
    expect(payload.children).toEqual([]);
  });

  it('depth=1 includes immediate children but not grandchildren', async () => {
    registry.register('sess-1', ROOT);

    const result = await tools.getTree({ sessionId: 'sess-1', depth: 1 });

    const payload = JSON.parse(result.content[0].text);
    const childA = payload.children.find((c: { id: string }) => c.id === CHILD_A);
    expect(childA.children).toEqual([]);
  });

  it('depth deeper than the actual subtree is fine (no error, all returned)', async () => {
    registry.register('sess-1', CHILD_A);

    const result = await tools.getTree({ sessionId: 'sess-1', depth: 99 });

    const payload = JSON.parse(result.content[0].text);
    expect(payload.children[0].id).toBe(GRANDCHILD);
  });

  it('returns an error when the session has no binding', async () => {
    const result = await tools.getTree({ sessionId: 'unknown' });
    expect(result.isError).toBe(true);
  });

  it('rejects a negative depth as invalid', async () => {
    registry.register('sess-1', CHILD_A);
    const result = await tools.getTree({ sessionId: 'sess-1', depth: -1 });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/depth|invalid/i);
  });
});

describe('createReadTools — list_contexts', () => {
  let registry: SessionBindingRegistry;
  let tools: ReadTools;

  beforeEach(() => {
    const made = makeDeps();
    registry = made.registry;
    tools = createReadTools(made.deps);
  });

  it('returns the contexts declared at or above the bound node', async () => {
    registry.register('sess-1', GRANDCHILD);

    const result = await tools.listContexts({ sessionId: 'sess-1' });

    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content[0].text);
    expect(Array.isArray(payload)).toBe(true);
    const ids = payload.map((c: { id: string }) => c.id);
    expect(ids).toContain(CTX_COLLAB);
    expect(ids).toContain(CTX_EXEC);
  });

  it('returns the currently applied context first when one is applied on the bound node', async () => {
    registry.register('sess-1', CHILD_A);

    const result = await tools.listContexts({ sessionId: 'sess-1' });

    const payload = JSON.parse(result.content[0].text);
    expect(payload[0]?.id).toBe(CTX_COLLAB);
    expect(payload[0]?.applied).toBe(true);
  });

  it('returns an empty list when no contexts are declared in scope', async () => {
    const isolated: TreeReadState = {
      nodes: {
        'lone-node': makeNode('lone-node', 'Alone', []),
      },
      rootNodeId: 'lone-node',
      ancestorRegistry: { 'lone-node': [] },
    };
    const made = makeDeps(isolated);
    const isolatedTools = createReadTools(made.deps);
    made.registry.register('sess-1', 'lone-node');

    const result = await isolatedTools.listContexts({ sessionId: 'sess-1' });

    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content[0].text);
    expect(payload).toEqual([]);
  });

  it('returns an error when the session has no binding', async () => {
    const result = await tools.listContexts({ sessionId: 'unknown' });
    expect(result.isError).toBe(true);
  });
});

describe('createReadTools — permission gate (read tools work in any mode)', () => {
  function withFlagsState(collaborate: boolean, execute: boolean): TreeReadState {
    const state = makeState();
    state.nodes[CTX_COLLAB] = {
      ...state.nodes[CTX_COLLAB],
      metadata: {
        ...state.nodes[CTX_COLLAB].metadata,
        collaborate,
        execute,
      },
    };
    return state;
  }

  it('succeeds when the bound step is collaborate-only', async () => {
    const made = makeDeps(withFlagsState(true, false));
    const tools = createReadTools(made.deps);
    made.registry.register('sess-1', CHILD_A);
    expect((await tools.getNode({ sessionId: 'sess-1' })).isError).toBeFalsy();
    expect((await tools.getTree({ sessionId: 'sess-1' })).isError).toBeFalsy();
    expect((await tools.listContexts({ sessionId: 'sess-1' })).isError).toBeFalsy();
  });

  it('succeeds when the bound step is execute-only', async () => {
    const made = makeDeps(withFlagsState(false, true));
    const tools = createReadTools(made.deps);
    made.registry.register('sess-1', CHILD_A);
    expect((await tools.getNode({ sessionId: 'sess-1' })).isError).toBeFalsy();
    expect((await tools.getTree({ sessionId: 'sess-1' })).isError).toBeFalsy();
    expect((await tools.listContexts({ sessionId: 'sess-1' })).isError).toBeFalsy();
  });

  it('succeeds when both flags are set', async () => {
    const made = makeDeps(withFlagsState(true, true));
    const tools = createReadTools(made.deps);
    made.registry.register('sess-1', CHILD_A);
    expect((await tools.getNode({ sessionId: 'sess-1' })).isError).toBeFalsy();
    expect((await tools.getTree({ sessionId: 'sess-1' })).isError).toBeFalsy();
    expect((await tools.listContexts({ sessionId: 'sess-1' })).isError).toBeFalsy();
  });

  it('succeeds in action mode (no flags set on the applied context)', async () => {
    const made = makeDeps(withFlagsState(false, false));
    const tools = createReadTools(made.deps);
    made.registry.register('sess-1', CHILD_A);
    expect((await tools.getNode({ sessionId: 'sess-1' })).isError).toBeFalsy();
    expect((await tools.getTree({ sessionId: 'sess-1' })).isError).toBeFalsy();
    expect((await tools.listContexts({ sessionId: 'sess-1' })).isError).toBeFalsy();
  });
});

describe('createReadTools — mode resolution is server-side and live', () => {
  it('a mode flip between calls is reflected in the next get_node response', async () => {
    let state = makeState();
    const registry = new SessionBindingRegistry();
    const tools = createReadTools({
      bindingRegistry: registry,
      treeReader: { readState: async () => state },
    });
    registry.register('sess-1', CHILD_A);

    const before = JSON.parse((await tools.getNode({ sessionId: 'sess-1' })).content[0].text);
    expect(before.mode.label).toBe('collaborate');

    state = makeState();
    state.nodes[CTX_COLLAB] = {
      ...state.nodes[CTX_COLLAB],
      metadata: {
        ...state.nodes[CTX_COLLAB].metadata,
        collaborate: true,
        execute: true,
      },
    };

    const after = JSON.parse((await tools.getNode({ sessionId: 'sess-1' })).content[0].text);
    expect(after.mode.label).toBe('both');
  });

  it('calls readState on every invocation rather than caching tree state', async () => {
    const readState = vi.fn(async () => makeState());
    const registry = new SessionBindingRegistry();
    const tools = createReadTools({
      bindingRegistry: registry,
      treeReader: { readState },
    });
    registry.register('sess-1', CHILD_A);

    await tools.getNode({ sessionId: 'sess-1' });
    await tools.getNode({ sessionId: 'sess-1' });
    await tools.getTree({ sessionId: 'sess-1' });

    expect(readState).toHaveBeenCalledTimes(3);
  });
});

describe('createReadTools — pending proposals are invisible to Claude (PR7)', () => {
  // "No MCP tool exposes pending unresolved proposals to Claude." Proposals
  // live in the renderer-side proposals store and never mutate the tree state
  // that read tools serve. These tests pin the property that read-tool
  // responses don't include any proposal-derived nodes, content, status, or
  // metadata regardless of how many proposals are queued for the bound session.
  it.todo('get_node returns the current node content even when a pending submit-step-output proposal carries different content for the same node');
  it.todo('get_node returns the current metadata.status even when a pending mark-step-complete proposal would change it');
  it.todo('get_tree does not include nodes from pending add-child proposals — the children list reflects only the applied tree');
  it.todo('get_tree does not omit nodes from pending delete proposals — the deletion has not landed yet');
  it.todo('list_contexts does not surface any proposal data — only contexts declared in the applied tree');
  it.todo('no MCP tool name in the registered set begins with "proposal" or "proposals" (proposal listing is intentionally unreachable from Claude)');
});
