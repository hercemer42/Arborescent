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
import { TreeReadState, TreeReadResult } from '../mcpReadTools';
import { TreeNode } from '../../../shared/types';
import { MCP_ERROR_CODES } from '../../../shared/utils/mcpErrorCodes';

function okRead(state: TreeReadState): TreeReadResult {
  return { kind: 'ok', state };
}

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const SIBLING = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
const STEP = 'dddddddd-dddd-dddd-dddd-dddddddddd04';
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

// Binding contract: the session binds to the SUBJECT (BOUND), which travels
// through the workflow. Its parent is the current STEP, which carries the
// stepType. The subject never carries stepType itself, so the fixture puts it
// on STEP and parents BOUND under it.
function makeState({ collaborate, execute, stepType }: SetupArgs): TreeReadState {
  const stepMetadata: TreeNode['metadata'] = {};
  if (stepType !== undefined) stepMetadata.stepType = stepType;
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [STEP, CTX]),
      [STEP]: makeNode(STEP, 'Step', [BOUND, SIBLING], stepMetadata),
      [BOUND]: makeNode(BOUND, 'Bound', [], { appliedContextId: CTX }),
      [SIBLING]: makeNode(SIBLING, 'Sibling', []),
      [CTX]: makeNode(CTX, 'Context', [], { isContextDeclaration: true, collaborate, execute }),
    },
    rootNodeId: ROOT,
    ancestorRegistry: { [ROOT]: [], [STEP]: [ROOT], [BOUND]: [ROOT, STEP], [SIBLING]: [ROOT, STEP], [CTX]: [ROOT] },
  };
}

function makeDeps(setup: SetupArgs) {
  const registry = new SessionBindingRegistry();
  const mutator: TreeMutator = {
    mutate: vi.fn(async () => ({ ok: true as const })),
  };
  // Mirrors renderer semantics: ok only when the bound node is in the owning
  // store, node-not-in-open-store otherwise.
  const treeReader = {
    readState: vi.fn(async (_sessionId: string, nodeId: string): Promise<TreeReadResult> => {
      const state = makeState(setup);
      return state.nodes[nodeId] ? okRead(state) : { kind: 'node-not-in-open-store' };
    }),
  };
  let nextProposalId = 1;
  const proposalSubmitter = {
    submit: vi.fn(async () => ({ ok: true as const, proposalId: `prop-${nextProposalId++}` })),
  };
  const oneShotTargetStore = {
    recordDoneDeclaration: vi.fn(),
  };
  return {
    registry,
    mutator,
    treeReader,
    proposalSubmitter,
    oneShotTargetStore,
    deps: { bindingRegistry: registry, treeReader, treeMutator: mutator, proposalSubmitter, oneShotTargetStore },
  };
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

// Collaborate-only authority allows every mutation KIND, but the autonomous
// direct-apply route refuses them toward the single submit channel — a
// direct-applied write would be wiped by the step's own rebuild. The kind
// authority survives on the proposal routes (see the checkpoint block below).
describe('createWriteTools — autonomous collaborate-only refuses direct-apply mutations toward submit_step_output', () => {
  let mutator: TreeMutator;
  let tools: WriteTools;

  beforeEach(() => {
    const made = makeDeps({ collaborate: true, execute: false, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    mutator = made.mutator;
    tools = createWriteTools(made.deps);
  });

  it.each(ALL_WRITE_TOOLS)('%s is refused on the autonomous route in collaborate-only mode', async (toolName) => {
    const result = await callTool(tools, toolName);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/submit_step_output/);
    expect(mutator.mutate).not.toHaveBeenCalled();
  });
});

describe('createWriteTools — checkpoint collaborate-only still allows every mutation kind via the proposal route', () => {
  let made: ReturnType<typeof makeDeps>;
  let tools: WriteTools;

  beforeEach(() => {
    made = makeDeps({ collaborate: true, execute: false, stepType: 'checkpoint' });
    made.registry.register('sess-1', BOUND);
    tools = createWriteTools(made.deps);
  });

  it.each(ALL_WRITE_TOOLS)('%s routes to the proposal submitter in collaborate-only mode', async (toolName) => {
    const result = await callTool(tools, toolName);
    expect(result.isError).toBeFalsy();
    expect(made.proposalSubmitter.submit).toHaveBeenCalledTimes(1);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });
});

describe('createWriteTools — intersection: destructive op + non-automatic step + collaborate+execute (PR7)', () => {
  // The authority gate must run BEFORE the proposal route. A destructive op on
  // a non-automatic step in collab+execute mode must error out — it must NOT
  // be queued as a proposal (which would let Claude bypass the destructive-in-both
  // restriction by claiming the step is manual).
  let made: ReturnType<typeof makeDeps>;
  let tools: WriteTools;

  beforeEach(() => {
    made = makeDeps({ collaborate: true, execute: true, stepType: 'manual' });
    made.registry.register('sess-1', BOUND);
    tools = createWriteTools(made.deps);
  });

  for (const stepType of ['manual', 'checkpoint', undefined] as const) {
    for (const toolName of DESTRUCTIVE_TOOLS) {
      it(`${toolName} on a ${stepType ?? 'no-stepType'} step in collab+execute mode errors and does NOT route to proposalSubmitter`, async () => {
        const made = makeDeps({ collaborate: true, execute: true, stepType });
        made.registry.register('sess-1', BOUND);
        const tools = createWriteTools(made.deps);

        const result = await callTool(tools, toolName);

        expect(result.isError).toBe(true);
        expect(result.content[0].text).toMatch(/execute-and-collaborate|only additions and check-offs/i);
        expect(made.mutator.mutate).not.toHaveBeenCalled();
        expect(made.proposalSubmitter.submit).not.toHaveBeenCalled();
      });
    }
  }

  it('additive ops on a non-automatic step in collab+execute mode still route to the proposal submitter', async () => {
    const result = await callTool(tools, 'addChildNode');
    expect(result.isError).toBeFalsy();
    expect(made.proposalSubmitter.submit).toHaveBeenCalledTimes(1);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
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

describe('createWriteTools — step-type gate: non-automatic steps route to the proposal submitter (PR7)', () => {
  // Routing is probed in both-mode: addChildNode is additive, so it is
  // permitted on every route and the probe isolates the step-type split.
  function withStepType(stepType: StepType | undefined) {
    const made = makeDeps({ collaborate: true, execute: true, stepType });
    made.registry.register('sess-1', BOUND);
    return { tools: createWriteTools(made.deps), mutator: made.mutator, proposalSubmitter: made.proposalSubmitter };
  }

  it('manual step does NOT call the mutator and routes the request to the proposal submitter', async () => {
    const { tools, mutator, proposalSubmitter } = withStepType('manual');
    const result = await callTool(tools, 'addChildNode');
    expect(result.isError).toBeFalsy();
    expect(mutator.mutate).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(result.content[0].text);
    expect(payload.applied).toBe(false);
    expect(payload.proposed).toBe(true);
    expect(payload.proposalId).toEqual(expect.any(String));
  });

  it('checkpoint step also routes to the proposal submitter', async () => {
    const { tools, mutator, proposalSubmitter } = withStepType('checkpoint');
    const result = await callTool(tools, 'addChildNode');
    expect(result.isError).toBeFalsy();
    expect(mutator.mutate).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
  });

  it('a node with no stepType set is treated as non-automatic and routed to the proposal submitter', async () => {
    const { tools, mutator, proposalSubmitter } = withStepType(undefined);
    const result = await callTool(tools, 'addChildNode');
    expect(result.isError).toBeFalsy();
    expect(mutator.mutate).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
  });

  it('autonomous step proceeds to the mutator (NOT the proposal submitter)', async () => {
    const { tools, mutator, proposalSubmitter } = withStepType('autonomous');
    const result = await callTool(tools, 'addChildNode');
    expect(result.isError).toBeFalsy();
    expect(mutator.mutate).toHaveBeenCalledTimes(1);
    expect(proposalSubmitter.submit).not.toHaveBeenCalled();
  });

  it('proposal submission carries the full MutationRequest so the renderer can render it for review', async () => {
    const { tools, proposalSubmitter } = withStepType('manual');
    await tools.addChildNode({ sessionId: 'sess-1', parent_id: BOUND, content: 'pending child' });
    expect(proposalSubmitter.submit).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      nodeId: BOUND,
      request: { kind: 'add-child', parentId: BOUND, content: 'pending child' },
    });
  });

  it('a proposal-submitter failure surfaces to Claude as an error', async () => {
    const { tools, proposalSubmitter } = withStepType('manual');
    (proposalSubmitter.submit as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      ok: false,
      error: 'no store for bound file',
    }));
    const result = await callTool(tools, 'addChildNode');
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('no store for bound file');
  });
});

// Collaborate-only autonomous does not direct-apply, so additive request
// shapes are pinned via both-mode (the remaining direct-apply path) and
// destructive shapes via the collaborate checkpoint proposal route.
describe('createWriteTools — happy paths: each additive tool issues the right MutationRequest shape (both-mode direct apply)', () => {
  let mutator: TreeMutator;
  let tools: WriteTools;

  beforeEach(() => {
    const made = makeDeps({ collaborate: true, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    mutator = made.mutator;
    tools = createWriteTools(made.deps);
  });

  it('addChildNode issues kind="add-child" with parent_id and content', async () => {
    await tools.addChildNode({ sessionId: 'sess-1', parent_id: BOUND, content: 'new child' });
    expect(mutator.mutate).toHaveBeenCalledWith('sess-1', BOUND, {
      kind: 'add-child',
      parentId: BOUND,
      content: 'new child',
    } satisfies MutationRequest);
  });

  it('appendToNode issues kind="append" with content', async () => {
    await tools.appendToNode({ sessionId: 'sess-1', content: 'tail' });
    expect(mutator.mutate).toHaveBeenCalledWith('sess-1', BOUND, {
      kind: 'append',
      content: 'tail',
    } satisfies MutationRequest);
  });

  it('markStepComplete issues kind="mark-complete" with the status', async () => {
    await tools.markStepComplete({ sessionId: 'sess-1', status: 'abandoned' });
    expect(mutator.mutate).toHaveBeenCalledWith('sess-1', BOUND, {
      kind: 'mark-complete',
      status: 'abandoned',
    } satisfies MutationRequest);
  });
});

describe('createWriteTools — happy paths: each destructive tool issues the right MutationRequest shape (collaborate checkpoint proposal route)', () => {
  let made: ReturnType<typeof makeDeps>;
  let tools: WriteTools;

  beforeEach(() => {
    made = makeDeps({ collaborate: true, execute: false, stepType: 'checkpoint' });
    made.registry.register('sess-1', BOUND);
    tools = createWriteTools(made.deps);
  });

  it('setNodeContent issues kind="set-content" with content', async () => {
    await tools.setNodeContent({ sessionId: 'sess-1', content: 'replaced' });
    expect(made.proposalSubmitter.submit).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      nodeId: BOUND,
      request: { kind: 'set-content', content: 'replaced' } satisfies MutationRequest,
    });
  });

  it('deleteNode issues kind="delete"', async () => {
    await tools.deleteNode({ sessionId: 'sess-1' });
    expect(made.proposalSubmitter.submit).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      nodeId: BOUND,
      request: { kind: 'delete' } satisfies MutationRequest,
    });
  });

  it('moveNode issues kind="move" with new_parent_id and optional position', async () => {
    await tools.moveNode({ sessionId: 'sess-1', new_parent_id: SIBLING, position: 2 });
    expect(made.proposalSubmitter.submit).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      nodeId: BOUND,
      request: { kind: 'move', newParentId: SIBLING, position: 2 } satisfies MutationRequest,
    });
  });

  it('setNodeMetadata issues kind="set-metadata" with key and value', async () => {
    await tools.setNodeMetadata({ sessionId: 'sess-1', key: 'custom', value: { x: 1 } });
    expect(made.proposalSubmitter.submit).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      nodeId: BOUND,
      request: { kind: 'set-metadata', key: 'custom', value: { x: 1 } } satisfies MutationRequest,
    });
  });
});

describe('createWriteTools — error propagation', () => {
  it('a write to an unbound session returns a descriptive error and does not call the mutator', async () => {
    const made = makeDeps({ collaborate: true, execute: true, stepType: 'autonomous' });
    const tools = createWriteTools(made.deps);

    const result = await callTool(tools, 'addChildNode');

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/no binding|not bound/i);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('a mutator returning ok=false surfaces the error message and marks isError', async () => {
    const made = makeDeps({ collaborate: true, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    made.mutator.mutate = vi.fn(async () => ({ ok: false as const, error: 'parent does not exist' }));
    const tools = createWriteTools(made.deps);

    const result = await callTool(tools, 'addChildNode');

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('parent does not exist');
  });

  it('a write against an orphan binding (node missing from tree) returns a descriptive error', async () => {
    const made = makeDeps({ collaborate: true, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', 'unknown-node');
    const tools = createWriteTools(made.deps);

    const result = await callTool(tools, 'addChildNode');

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/deleted|not in the file/i);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('a write when the tree state is unavailable returns a descriptive error', async () => {
    const registry = new SessionBindingRegistry();
    const mutator: TreeMutator = { mutate: vi.fn(async () => ({ ok: true as const })) };
    const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) };
    const oneShotTargetStore = { recordDoneDeclaration: vi.fn() };
    const tools = createWriteTools({
      bindingRegistry: registry,
      treeReader: { readState: async (): Promise<TreeReadResult> => ({ kind: 'not-ready' }) },
      treeMutator: mutator,
      proposalSubmitter,
      oneShotTargetStore,
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
      readState: async () => okRead({
        nodes: {
          [ROOT]: makeNode(ROOT, 'Root', [STEP]),
          [STEP]: makeNode(STEP, 'Step', [BOUND], { stepType: 'autonomous' }),
          [BOUND]: makeNode(BOUND, 'Bound', []),
        },
        rootNodeId: ROOT,
        ancestorRegistry: { [ROOT]: [], [STEP]: [ROOT], [BOUND]: [ROOT, STEP] },
      }),
    };
    registry.register('sess-1', BOUND);
    const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) };
    const oneShotTargetStore = { recordDoneDeclaration: vi.fn() };
    tools = createWriteTools({ bindingRegistry: registry, treeReader, treeMutator: mutator, proposalSubmitter, oneShotTargetStore });
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
  // The liveness probe rides both-mode addChildNode (the autonomous
  // direct-apply path) and flips the context to action mode, since
  // collaborate-only autonomous does not direct-apply.
  it('flipping the mode between calls is reflected immediately', async () => {
    const registry = new SessionBindingRegistry();
    let execute = true;
    const treeReader = {
      readState: async () =>
        okRead(makeState({ collaborate: execute, execute, stepType: 'autonomous' })),
    };
    const mutator: TreeMutator = { mutate: vi.fn(async () => ({ ok: true as const })) };
    const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) };
    const oneShotTargetStore = { recordDoneDeclaration: vi.fn() };
    const tools = createWriteTools({ bindingRegistry: registry, treeReader, treeMutator: mutator, proposalSubmitter, oneShotTargetStore });
    registry.register('sess-1', BOUND);

    // both-mode (collaborate+execute): additive direct-apply allowed
    const first = await tools.addChildNode({ sessionId: 'sess-1', parent_id: BOUND, content: 'child' });
    expect(first.isError).toBeFalsy();

    execute = false; // context edit lands mid-run: collaborate flag also drops → action mode, all writes refused
    const second = await tools.addChildNode({ sessionId: 'sess-1', parent_id: BOUND, content: 'child' });
    expect(second.isError).toBe(true);
    expect(mutator.mutate).toHaveBeenCalledTimes(1);
  });
});

describe('createWriteTools — announceStepDone (inverse authority gate for action / execute-only modes)', () => {
  it('announceStepDone on an execute-only autonomous step issues a mark-complete mutation', async () => {
    const made = makeDeps({ collaborate: false, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledWith('sess-1', BOUND, {
      kind: 'mark-complete',
      status: 'completed',
    } satisfies MutationRequest);
  });

  it('announceStepDone on a pure action-mode autonomous step issues a mark-complete mutation', async () => {
    const made = makeDeps({ collaborate: false, execute: false, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledWith('sess-1', BOUND, {
      kind: 'mark-complete',
      status: 'completed',
    } satisfies MutationRequest);
  });

  it('announceStepDone is REJECTED on a collaborate-only step and the error names submit_step_output as the alternative', async () => {
    const made = makeDeps({ collaborate: true, execute: false, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('submit_step_output');
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  // Both-mode steps work incrementally and complete via announce — a
  // rejection here would redirect agents into the destructive submit rebuild.
  it('announceStepDone is PERMITTED on a both-mode (collaborate+execute) step — announce is its completion channel', async () => {
    const made = makeDeps({ collaborate: true, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledWith('sess-1', BOUND, { kind: 'mark-complete', status: 'completed' });
  });

  it('announceStepDone returns a descriptive error when no binding exists for the session', async () => {
    const made = makeDeps({ collaborate: false, execute: true, stepType: 'autonomous' });
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-unbound' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/no binding|not bound/i);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('announceStepDone returns a no-context error when no context is applied (no permissive fallback)', async () => {
    const registry = new SessionBindingRegistry();
    const mutator: TreeMutator = { mutate: vi.fn(async () => ({ ok: true as const })) };
    const treeReader = {
      readState: async () => okRead({
        nodes: {
          [ROOT]: makeNode(ROOT, 'Root', [STEP]),
          [STEP]: makeNode(STEP, 'Step', [BOUND], { stepType: 'autonomous' }),
          [BOUND]: makeNode(BOUND, 'Bound', []),
        },
        rootNodeId: ROOT,
        ancestorRegistry: { [ROOT]: [], [STEP]: [ROOT], [BOUND]: [ROOT, STEP] },
      }),
    };
    registry.register('sess-1', BOUND);
    const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) };
    const oneShotTargetStore = { recordDoneDeclaration: vi.fn() };
    const tools = createWriteTools({ bindingRegistry: registry, treeReader, treeMutator: mutator, proposalSubmitter, oneShotTargetStore });

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/no context is applied|require.*applied context|announce_step_done requires/i);
    expect(mutator.mutate).not.toHaveBeenCalled();
  });

  it('announceStepDone does NOT route through the proposal submitter — it applies directly when the step is autonomous', async () => {
    const made = makeDeps({ collaborate: false, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(made.proposalSubmitter.submit).not.toHaveBeenCalled();
    expect(made.mutator.mutate).toHaveBeenCalledTimes(1);
  });

  it('announceStepDone returns a descriptive error when the bound node is missing from the tree (orphan binding)', async () => {
    const made = makeDeps({ collaborate: false, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', 'unknown-node');
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/deleted|not in the file/i);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('announceStepDone surfaces a mutator failure as an error', async () => {
    const made = makeDeps({ collaborate: false, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    made.mutator.mutate = vi.fn(async () => ({ ok: false as const, error: 'step already completed' }));
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('step already completed');
  });

  it('announceStepDone sets the done-declaration on the OneShotTargetStore after a successful mutation so the Stop-hook gate lets the workflow advance', async () => {
    const made = makeDeps({ collaborate: false, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBeFalsy();
    expect(made.oneShotTargetStore.recordDoneDeclaration).toHaveBeenCalledWith("sess-1", BOUND);
  });

  it('announceStepDone does NOT set the done-declaration when the mutator fails (the workflow should stay in-flight on failure)', async () => {
    const made = makeDeps({ collaborate: false, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    made.mutator.mutate = vi.fn(async () => ({ ok: false as const, error: 'mutator boom' }));
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBe(true);
    expect(made.oneShotTargetStore.recordDoneDeclaration).not.toHaveBeenCalled();
  });

  it('announceStepDone does NOT set the done-declaration when the authority check rejects (collaborate-mode)', async () => {
    const made = makeDeps({ collaborate: true, execute: false, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(made.oneShotTargetStore.recordDoneDeclaration).not.toHaveBeenCalled();
  });

  it('announceStepDone is REJECTED on a manual step in execute-only mode and does NOT mutate or set the done-declaration', async () => {
    const made = makeDeps({ collaborate: false, execute: true, stepType: 'manual' });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/autonomous/i);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
    expect(made.oneShotTargetStore.recordDoneDeclaration).not.toHaveBeenCalled();
  });

  it('announceStepDone is ACCEPTED on a checkpoint step in action-mode and issues a mark-complete (the checkpoint then pauses for validation via the Stop handler)', async () => {
    const made = makeDeps({ collaborate: false, execute: false, stepType: 'checkpoint' });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledWith('sess-1', BOUND, {
      kind: 'mark-complete',
      status: 'completed',
    } satisfies MutationRequest);
    expect(made.oneShotTargetStore.recordDoneDeclaration).toHaveBeenCalledWith("sess-1", BOUND);
    expect(made.proposalSubmitter.submit).not.toHaveBeenCalled();
  });

  // Regression: real bindings often target a CONTENT child of an autonomous
  // step, not the step root. submit_step_output already treats that as
  // autonomous via isStructurallyAutonomous; announceStepDone must agree, or
  // identical configurations split between "this works" and "only valid on
  // autonomous workflow steps" depending on which tool the agent reaches for.
  it('announceStepDone on a subject whose parent step is autonomous issues a mark-complete mutation', async () => {
    const registry = new SessionBindingRegistry();
    const mutator: TreeMutator = { mutate: vi.fn(async () => ({ ok: true as const })) };
    const treeReader = {
      readState: async () => okRead({
        nodes: {
          [ROOT]: makeNode(ROOT, 'Root', [STEP, CTX]),
          [STEP]: makeNode(STEP, 'Autonomous step', [BOUND], { stepType: 'autonomous' as const }),
          [BOUND]: makeNode(BOUND, 'CONTENT child', [], { appliedContextId: CTX }),
          [CTX]: makeNode(CTX, 'Context', [], { isContextDeclaration: true, collaborate: false, execute: true }),
        },
        rootNodeId: ROOT,
        ancestorRegistry: { [ROOT]: [], [STEP]: [ROOT], [BOUND]: [ROOT, STEP], [CTX]: [ROOT] },
      }),
    };
    registry.register('sess-1', BOUND);
    const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) };
    const oneShotTargetStore = { recordDoneDeclaration: vi.fn() };
    const tools = createWriteTools({ bindingRegistry: registry, treeReader, treeMutator: mutator, proposalSubmitter, oneShotTargetStore });

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBeFalsy();
    expect(mutator.mutate).toHaveBeenCalledWith('sess-1', BOUND, {
      kind: 'mark-complete',
      status: 'completed',
    } satisfies MutationRequest);
    expect(oneShotTargetStore.recordDoneDeclaration).toHaveBeenCalledWith("sess-1", BOUND);
  });
});

describe('createWriteTools — announceStepDone on a checkpoint: mode and context guards still apply', () => {
  it('accepts the done-signal on a checkpoint step in execute-only mode (collaborate:false, execute:true)', async () => {
    const made = makeDeps({ collaborate: false, execute: true, stepType: 'checkpoint' });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledWith('sess-1', BOUND, {
      kind: 'mark-complete',
      status: 'completed',
    } satisfies MutationRequest);
  });

  it('still rejects the done-signal on a checkpoint when no context is applied at all (the no-context guard is unchanged)', async () => {
    const registry = new SessionBindingRegistry();
    const mutator: TreeMutator = { mutate: vi.fn(async () => ({ ok: true as const })) };
    const treeReader = {
      readState: async () => okRead({
        nodes: {
          [ROOT]: makeNode(ROOT, 'Root', [STEP]),
          [STEP]: makeNode(STEP, 'Step', [BOUND], { stepType: 'checkpoint' as const }),
          [BOUND]: makeNode(BOUND, 'Bound', []),
        },
        rootNodeId: ROOT,
        ancestorRegistry: { [ROOT]: [], [STEP]: [ROOT], [BOUND]: [ROOT, STEP] },
      }),
    };
    registry.register('sess-1', BOUND);
    const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) };
    const oneShotTargetStore = { recordDoneDeclaration: vi.fn() };
    const tools = createWriteTools({ bindingRegistry: registry, treeReader, treeMutator: mutator, proposalSubmitter, oneShotTargetStore });

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/no context is applied|requires an explicitly applied/i);
    expect(mutator.mutate).not.toHaveBeenCalled();
  });

  it('still rejects the done-signal on a checkpoint whose applied context is collaborate=true and names submit_step_output instead', async () => {
    const made = makeDeps({ collaborate: true, execute: false, stepType: 'checkpoint' });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('submit_step_output');
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('rejection messages distinguish "no context applied" from "context applied but in collaborate mode"', async () => {
    const registry = new SessionBindingRegistry();
    const mutator: TreeMutator = { mutate: vi.fn(async () => ({ ok: true as const })) };
    const treeReader = {
      readState: async () => okRead({
        nodes: {
          [ROOT]: makeNode(ROOT, 'Root', [STEP]),
          [STEP]: makeNode(STEP, 'Step', [BOUND], { stepType: 'checkpoint' as const }),
          [BOUND]: makeNode(BOUND, 'Bound', []),
        },
        rootNodeId: ROOT,
        ancestorRegistry: { [ROOT]: [], [STEP]: [ROOT], [BOUND]: [ROOT, STEP] },
      }),
    };
    registry.register('sess-1', BOUND);
    const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) };
    const oneShotTargetStore = { recordDoneDeclaration: vi.fn() };
    const noContextTools = createWriteTools({ bindingRegistry: registry, treeReader, treeMutator: mutator, proposalSubmitter, oneShotTargetStore });

    const noContext = await noContextTools.announceStepDone({ sessionId: 'sess-1' });

    const collab = makeDeps({ collaborate: true, execute: false, stepType: 'checkpoint' });
    collab.registry.register('sess-2', BOUND);
    const wrongMode = await createWriteTools(collab.deps).announceStepDone({ sessionId: 'sess-2' });

    expect(noContext.content[0].text).toMatch(/no context is applied/i);
    expect(noContext.content[0].text).not.toMatch(/collaborate/i);
    expect(wrongMode.content[0].text).toMatch(/collaborate/i);
  });
});

// When the user stops a run mid-prompt, the renderer mutator refuses the
// completion with a write/node-not-running code (it is the only layer that can
// see workflowExecutionStates). The write tools must surface that exact code to
// the MCP client rather than collapsing it into the generic upstream-failure
// code, and must not mark the turn as having seen an explicit submit.
describe('createWriteTools — a stopped node\'s mutator refusal surfaces as write/node-not-running', () => {
  function codeOf(result: unknown): string | undefined {
    return (result as { structuredContent?: { code?: string } }).structuredContent?.code;
  }

  function stoppedMutator() {
    return vi.fn(async () => ({
      ok: false as const,
      error: 'Node is not in play — its workflow run was stopped, so the step cannot be completed',
      code: MCP_ERROR_CODES.writeNodeNotRunning,
    }));
  }

  it('announceStepDone surfaces write/node-not-running and does NOT set the done-declaration', async () => {
    const made = makeDeps({ collaborate: false, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    made.mutator.mutate = stoppedMutator();
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/node-not-running');
    expect(made.oneShotTargetStore.recordDoneDeclaration).not.toHaveBeenCalled();
  });

  it('markStepComplete surfaces write/node-not-running', async () => {
    const made = makeDeps({ collaborate: true, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    made.mutator.mutate = stoppedMutator();
    const tools = createWriteTools(made.deps);

    const result = await tools.markStepComplete({ sessionId: 'sess-1', status: 'completed' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/node-not-running');
  });

  it('a codeless mutator failure still falls back to write/upstream-failure (no regression)', async () => {
    const made = makeDeps({ collaborate: false, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    made.mutator.mutate = vi.fn(async () => ({ ok: false as const, error: 'some downstream failure' }));
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/upstream-failure');
  });
});
