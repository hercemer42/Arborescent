import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import {
  createWriteTools,
  WriteTools,
  TreeMutator,
  MutationRequest,
} from '../mcpWriteTools';
import { TreeReadState } from '../mcpReadTools';
import { TreeNode } from '../../../shared/types';

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const SIBLING = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
const CTX = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05';

type StepType = 'manual' | 'checkpoint' | 'autonomous';

interface SetupArgs {
  collaborate: boolean;
  execute: boolean;
  stepType?: StepType;
}

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

function makeState({ collaborate, execute, stepType }: SetupArgs): TreeReadState {
  const boundMetadata: TreeNode['metadata'] = { appliedContextId: CTX };
  if (stepType !== undefined) boundMetadata.stepType = stepType;
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [BOUND, SIBLING, CTX]),
      [BOUND]: makeNode(BOUND, 'Bound', [], boundMetadata),
      [SIBLING]: makeNode(SIBLING, 'Sibling', []),
      [CTX]: makeNode(CTX, 'Context', [], { isContextDeclaration: true, collaborate, execute }),
    },
    rootNodeId: ROOT,
    ancestorRegistry: { [ROOT]: [], [BOUND]: [ROOT], [SIBLING]: [ROOT], [CTX]: [ROOT] },
  };
}

function makeDeps(setup: SetupArgs) {
  const registry = new SessionBindingRegistry();
  const mutator: TreeMutator = {
    mutate: vi.fn(async () => ({ ok: true as const })),
  };
  const treeReader = { readState: vi.fn(async () => makeState(setup)) };
  return { registry, mutator, treeReader, deps: { bindingRegistry: registry, treeReader, treeMutator: mutator } };
}

const ADDITIVE_TOOLS = ['addChildNode', 'appendToNode', 'markStepComplete'] as const;
const DESTRUCTIVE_TOOLS = ['setNodeContent', 'deleteNode', 'moveNode', 'setNodeMetadata'] as const;
const ALL_WRITE_TOOLS = [...ADDITIVE_TOOLS, ...DESTRUCTIVE_TOOLS];

function callTool(tools: WriteTools, name: string): Promise<{ isError?: boolean; content: Array<{ text: string }> }> {
  switch (name) {
    case 'addChildNode':
      return tools.addChildNode({ sessionId: 'sess-1', parent_id: BOUND, content: 'new child' });
    case 'appendToNode':
      return tools.appendToNode({ sessionId: 'sess-1', content: 'appended' });
    case 'markStepComplete':
      return tools.markStepComplete({ sessionId: 'sess-1', status: 'completed' });
    case 'setNodeContent':
      return tools.setNodeContent({ sessionId: 'sess-1', content: 'replaced' });
    case 'deleteNode':
      return tools.deleteNode({ sessionId: 'sess-1' });
    case 'moveNode':
      return tools.moveNode({ sessionId: 'sess-1', new_parent_id: SIBLING });
    case 'setNodeMetadata':
      return tools.setNodeMetadata({ sessionId: 'sess-1', key: 'custom', value: 'x' });
    default:
      throw new Error(`unknown tool ${name}`);
  }
}

describe('createWriteTools — mode authority: execute-only blocks every tree-modifying tool', () => {
  let tools: WriteTools;

  beforeEach(() => {
    const made = makeDeps({ collaborate: false, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    tools = createWriteTools(made.deps);
  });

  it.each(ALL_WRITE_TOOLS)('%s returns a descriptive error in execute-only mode', async (toolName) => {
    const result = await callTool(tools, toolName);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/execute-only|does not permit node modifications/i);
  });
});

describe('createWriteTools — mode authority: collaborate-only allows every tree-modifying tool', () => {
  let mutator: TreeMutator;
  let tools: WriteTools;

  beforeEach(() => {
    const made = makeDeps({ collaborate: true, execute: false, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    mutator = made.mutator;
    tools = createWriteTools(made.deps);
  });

  it.each(ALL_WRITE_TOOLS)('%s is mode-allowed in collaborate-only mode', async (toolName) => {
    const result = await callTool(tools, toolName);
    expect(result.isError).toBeFalsy();
    expect(mutator.mutate).toHaveBeenCalled();
  });
});

describe('createWriteTools — mode authority: collaborate+execute allows only additions and check-offs', () => {
  let mutator: TreeMutator;
  let tools: WriteTools;

  beforeEach(() => {
    const made = makeDeps({ collaborate: true, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    mutator = made.mutator;
    tools = createWriteTools(made.deps);
  });

  it.each(ADDITIVE_TOOLS)('%s is allowed in collaborate+execute mode', async (toolName) => {
    const result = await callTool(tools, toolName);
    expect(result.isError).toBeFalsy();
    expect(mutator.mutate).toHaveBeenCalled();
  });

  it.each(DESTRUCTIVE_TOOLS)('%s is blocked in collaborate+execute mode with a descriptive error', async (toolName) => {
    const result = await callTool(tools, toolName);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/execute-and-collaborate|only additions and check-offs/i);
    expect(mutator.mutate).not.toHaveBeenCalled();
  });
});

describe('createWriteTools — step-type gate: non-automatic steps reject mutations in this PR', () => {
  function withStepType(stepType: StepType | undefined) {
    const made = makeDeps({ collaborate: true, execute: false, stepType });
    made.registry.register('sess-1', BOUND);
    return { tools: createWriteTools(made.deps), mutator: made.mutator };
  }

  it('manual step rejects with a not-yet-supported error', async () => {
    const { tools, mutator } = withStepType('manual');
    const result = await callTool(tools, 'addChildNode');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/non-automatic|not yet|requires user review|proposal/i);
    expect(mutator.mutate).not.toHaveBeenCalled();
  });

  it('checkpoint step rejects with a not-yet-supported error', async () => {
    const { tools, mutator } = withStepType('checkpoint');
    const result = await callTool(tools, 'addChildNode');
    expect(result.isError).toBe(true);
    expect(mutator.mutate).not.toHaveBeenCalled();
  });

  it('a node with no stepType set is treated as non-automatic and rejected', async () => {
    const { tools, mutator } = withStepType(undefined);
    const result = await callTool(tools, 'addChildNode');
    expect(result.isError).toBe(true);
    expect(mutator.mutate).not.toHaveBeenCalled();
  });

  it('autonomous step proceeds to the mutator', async () => {
    const { tools, mutator } = withStepType('autonomous');
    const result = await callTool(tools, 'addChildNode');
    expect(result.isError).toBeFalsy();
    expect(mutator.mutate).toHaveBeenCalledTimes(1);
  });
});

describe('createWriteTools — happy paths: each tool issues the right MutationRequest shape', () => {
  let mutator: TreeMutator;
  let tools: WriteTools;

  beforeEach(() => {
    const made = makeDeps({ collaborate: true, execute: false, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    mutator = made.mutator;
    tools = createWriteTools(made.deps);
  });

  it('addChildNode issues kind="add-child" with parent_id and content', async () => {
    await tools.addChildNode({ sessionId: 'sess-1', parent_id: BOUND, content: 'new child' });
    expect(mutator.mutate).toHaveBeenCalledWith(BOUND, {
      kind: 'add-child',
      parentId: BOUND,
      content: 'new child',
    } satisfies MutationRequest);
  });

  it('appendToNode issues kind="append" with content', async () => {
    await tools.appendToNode({ sessionId: 'sess-1', content: 'tail' });
    expect(mutator.mutate).toHaveBeenCalledWith(BOUND, {
      kind: 'append',
      content: 'tail',
    } satisfies MutationRequest);
  });

  it('markStepComplete issues kind="mark-complete" with the status', async () => {
    await tools.markStepComplete({ sessionId: 'sess-1', status: 'abandoned' });
    expect(mutator.mutate).toHaveBeenCalledWith(BOUND, {
      kind: 'mark-complete',
      status: 'abandoned',
    } satisfies MutationRequest);
  });

  it('setNodeContent issues kind="set-content" with content', async () => {
    await tools.setNodeContent({ sessionId: 'sess-1', content: 'replaced' });
    expect(mutator.mutate).toHaveBeenCalledWith(BOUND, {
      kind: 'set-content',
      content: 'replaced',
    } satisfies MutationRequest);
  });

  it('deleteNode issues kind="delete"', async () => {
    await tools.deleteNode({ sessionId: 'sess-1' });
    expect(mutator.mutate).toHaveBeenCalledWith(BOUND, { kind: 'delete' } satisfies MutationRequest);
  });

  it('moveNode issues kind="move" with new_parent_id and optional position', async () => {
    await tools.moveNode({ sessionId: 'sess-1', new_parent_id: SIBLING, position: 2 });
    expect(mutator.mutate).toHaveBeenCalledWith(BOUND, {
      kind: 'move',
      newParentId: SIBLING,
      position: 2,
    } satisfies MutationRequest);
  });

  it('setNodeMetadata issues kind="set-metadata" with key and value', async () => {
    await tools.setNodeMetadata({ sessionId: 'sess-1', key: 'custom', value: { x: 1 } });
    expect(mutator.mutate).toHaveBeenCalledWith(BOUND, {
      kind: 'set-metadata',
      key: 'custom',
      value: { x: 1 },
    } satisfies MutationRequest);
  });
});

describe('createWriteTools — error propagation', () => {
  it('a write to an unbound session returns a descriptive error and does not call the mutator', async () => {
    const made = makeDeps({ collaborate: true, execute: false, stepType: 'autonomous' });
    const tools = createWriteTools(made.deps);

    const result = await callTool(tools, 'addChildNode');

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/no binding|not bound/i);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('a mutator returning ok=false surfaces the error message and marks isError', async () => {
    const made = makeDeps({ collaborate: true, execute: false, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    made.mutator.mutate = vi.fn(async () => ({ ok: false as const, error: 'parent does not exist' }));
    const tools = createWriteTools(made.deps);

    const result = await callTool(tools, 'addChildNode');

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('parent does not exist');
  });

  it('a write against an orphan binding (node missing from tree) returns a descriptive error', async () => {
    const made = makeDeps({ collaborate: true, execute: false, stepType: 'autonomous' });
    made.registry.register('sess-1', 'unknown-node');
    const tools = createWriteTools(made.deps);

    const result = await callTool(tools, 'addChildNode');

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not found|orphan/i);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('a write when the tree state is unavailable returns a descriptive error', async () => {
    const registry = new SessionBindingRegistry();
    const mutator: TreeMutator = { mutate: vi.fn(async () => ({ ok: true as const })) };
    const tools = createWriteTools({
      bindingRegistry: registry,
      treeReader: { readState: async () => null },
      treeMutator: mutator,
    });
    registry.register('sess-1', BOUND);

    const result = await callTool(tools, 'addChildNode');

    expect(result.isError).toBe(true);
    expect(mutator.mutate).not.toHaveBeenCalled();
  });
});

describe('createWriteTools — mode authority: no applied context blocks every tree-modifying tool', () => {
  let tools: WriteTools;

  beforeEach(() => {
    // Bound node has no appliedContextId (and no ancestors do either) — fall through
    // to permissive defaults must NOT be allowed. We use a stripped-down state where
    // the bound node has no metadata.appliedContextId.
    const registry = new SessionBindingRegistry();
    const mutator: TreeMutator = { mutate: vi.fn(async () => ({ ok: true as const })) };
    const treeReader = {
      readState: async () => ({
        nodes: {
          [ROOT]: makeNode(ROOT, 'Root', [BOUND]),
          [BOUND]: makeNode(BOUND, 'Bound', [], { stepType: 'autonomous' }),
        },
        rootNodeId: ROOT,
        ancestorRegistry: { [ROOT]: [], [BOUND]: [ROOT] },
      }),
    };
    registry.register('sess-1', BOUND);
    tools = createWriteTools({ bindingRegistry: registry, treeReader, treeMutator: mutator });
  });

  it.each(ALL_WRITE_TOOLS)('%s returns a no-context error when no context is applied', async (toolName) => {
    const result = await callTool(tools, toolName);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/no context is applied|require.*applied context/i);
  });
});

describe('createWriteTools — mode authority: action mode (collaborate=false, execute=false) is distinct from execute-only', () => {
  let tools: WriteTools;

  beforeEach(() => {
    const made = makeDeps({ collaborate: false, execute: false, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    tools = createWriteTools(made.deps);
  });

  it.each(ALL_WRITE_TOOLS)('%s returns an action-mode error (not an execute-only error)', async (toolName) => {
    const result = await callTool(tools, toolName);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/action-mode|neither execute nor collaborate/i);
    expect(result.content[0].text).not.toMatch(/execute-only/i);
  });
});

describe('createWriteTools — server-side authority is live (no caching)', () => {
  it('flipping the mode between calls is reflected immediately', async () => {
    const registry = new SessionBindingRegistry();
    let collaborate = true;
    const treeReader = {
      readState: async () =>
        makeState({ collaborate, execute: false, stepType: 'autonomous' }),
    };
    const mutator: TreeMutator = { mutate: vi.fn(async () => ({ ok: true as const })) };
    const tools = createWriteTools({ bindingRegistry: registry, treeReader, treeMutator: mutator });
    registry.register('sess-1', BOUND);

    const first = await tools.deleteNode({ sessionId: 'sess-1' });
    expect(first.isError).toBeFalsy();

    collaborate = false; // flip to execute-only state by removing collaborate
    const second = await tools.deleteNode({ sessionId: 'sess-1' });
    expect(second.isError).toBe(true);
    expect(mutator.mutate).toHaveBeenCalledTimes(1);
  });
});
