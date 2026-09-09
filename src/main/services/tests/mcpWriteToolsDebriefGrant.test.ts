import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import { createWriteTools, WriteTools, TreeMutator } from '../mcpWriteTools';
import { TreeReadState, TreeReadResult } from '../mcpReadTools';
import { TreeNode } from '../../../shared/types';

// Pins the destination-scoped debrief grant: a step carrying
// debriefDestinationId authorises add-child into that subtree ONLY, keyed on
// the request kind and the target together. The context-mode table is not
// widened, so the grant must be independent of mode while every other
// mutation kind stays governed by it.
//
// Second axis pinned here: an add-child parent is currently unchecked — the
// gate scopes a target to the bound subtree only for mark_step_complete's
// node_id. These tests require add-child to be scoped too, which narrows
// existing both-mode steps and is why the gate ships as its own commit.

function okRead(state: TreeReadState): TreeReadResult {
  return { kind: 'ok', state };
}

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const SIBLING = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
const STEP = 'dddddddd-dddd-dddd-dddd-dddddddddd04';
const CTX = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05';
const CHILD = 'ffffffff-ffff-ffff-ffff-ffffffffff06';
const FINDINGS = '11111111-1111-1111-1111-111111111107';
const FINDING_A = '22222222-2222-2222-2222-222222222208';
const BACKLINK = '33333333-3333-3333-3333-333333333309';
const DESCRIPTION = '44444444-4444-4444-4444-444444444410';
const DANGLING = '99999999-9999-9999-9999-999999999999';
const WORKFLOW = '55555555-5555-5555-5555-555555555511';

type StepType = 'manual' | 'checkpoint' | 'autonomous';

interface SetupArgs {
  collaborate?: boolean;
  execute?: boolean;
  stepType?: StepType;
  debriefDestinationId?: string;
}

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

// FINDINGS sits outside the bound subtree, under ROOT: the whole point of the
// grant is that the session reaches a subtree its binding does not cover.
function makeState({
  collaborate = true,
  execute = true,
  stepType = 'autonomous',
  debriefDestinationId,
}: SetupArgs): TreeReadState {
  const stepMetadata: TreeNode['metadata'] = {};
  if (stepType !== undefined) stepMetadata.stepType = stepType;
  if (debriefDestinationId !== undefined) stepMetadata.debriefDestinationId = debriefDestinationId;
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [WORKFLOW, CTX, FINDINGS]),
      [WORKFLOW]: makeNode(WORKFLOW, 'Work', [STEP], { isWorkflow: true }),
      [STEP]: makeNode(STEP, 'Step', [BOUND, SIBLING], stepMetadata),
      [BOUND]: makeNode(BOUND, 'Bound', [CHILD], { appliedContextId: CTX }),
      [CHILD]: makeNode(CHILD, 'Item under bound', []),
      [SIBLING]: makeNode(SIBLING, 'Sibling outside bound subtree', []),
      [CTX]: makeNode(CTX, 'Context', [], { isContextDeclaration: true, collaborate, execute }),
      [FINDINGS]: makeNode(FINDINGS, 'Findings', [FINDING_A], { isFindingsRoot: true }),
      [FINDING_A]: makeNode(FINDING_A, 'Step prompts under-specify their output', [DESCRIPTION, BACKLINK], { expanded: false }),
      [DESCRIPTION]: makeNode(DESCRIPTION, 'The prompt named no output format', []),
      [BACKLINK]: makeNode(BACKLINK, 'Seen in 001', [], { isHyperlink: true, linkedNodeId: BOUND }),
    },
    rootNodeId: ROOT,
    ancestorRegistry: {
      [ROOT]: [],
      [WORKFLOW]: [ROOT],
      [STEP]: [ROOT, WORKFLOW],
      [BOUND]: [ROOT, WORKFLOW, STEP],
      [CHILD]: [ROOT, WORKFLOW, STEP, BOUND],
      [SIBLING]: [ROOT, WORKFLOW, STEP],
      [CTX]: [ROOT],
      [FINDINGS]: [ROOT],
      [FINDING_A]: [ROOT, FINDINGS],
      [DESCRIPTION]: [ROOT, FINDINGS, FINDING_A],
      [BACKLINK]: [ROOT, FINDINGS, FINDING_A],
    },
  };
}

function makeDeps(setup: SetupArgs) {
  const registry = new SessionBindingRegistry();
  const mutator: TreeMutator = {
    mutate: vi.fn(async () => ({ ok: true as const })),
  };
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
  const oneShotTargetStore = { recordDoneDeclaration: vi.fn() };
  return {
    registry,
    mutator,
    proposalSubmitter,
    deps: { bindingRegistry: registry, treeReader, treeMutator: mutator, proposalSubmitter, oneShotTargetStore },
  };
}

function bind(setup: SetupArgs): { tools: WriteTools; made: ReturnType<typeof makeDeps> } {
  const made = makeDeps(setup);
  made.registry.register('sess-1', BOUND);
  return { tools: createWriteTools(made.deps), made };
}

describe('debrief grant — add-child into the configured Findings subtree', () => {
  let made: ReturnType<typeof makeDeps>;
  let tools: WriteTools;

  beforeEach(() => {
    vi.clearAllMocks();
    const bound = bind({ debriefDestinationId: FINDINGS });
    made = bound.made;
    tools = bound.tools;
  });

  it('applies an add-child whose parent is the Findings node itself', async () => {
    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: FINDINGS, content: 'A new finding' });

    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledWith('sess-1', BOUND, {
      kind: 'add-child',
      parentId: FINDINGS,
      content: 'A new finding',
      debriefDestinationId: FINDINGS,
    });
  });

  // The applier attaches evidence for the writes the gate labelled, so a write
  // that merely lands near a Findings node cannot trigger the transform.
  it('labels a write inside the granted subtree with the destination it landed in', async () => {
    await tools.addChildNode({ sessionId: 'sess-1', parent_id: FINDING_A, content: 'more detail' });

    expect(made.mutator.mutate).toHaveBeenCalledWith(
      'sess-1',
      BOUND,
      expect.objectContaining({ debriefDestinationId: FINDINGS }),
    );
  });

  it('leaves a write inside the bound subtree unlabelled', async () => {
    await tools.addChildNode({ sessionId: 'sess-1', parent_id: CHILD, content: 'ordinary child' });

    expect(made.mutator.mutate).toHaveBeenCalledWith(
      'sess-1',
      BOUND,
      expect.not.objectContaining({ debriefDestinationId: expect.anything() }),
    );
  });

  it('applies an add-child whose parent is an existing finding inside the granted subtree', async () => {
    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: FINDING_A, content: 'more detail' });

    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledTimes(1);
  });

  it('still applies an add-child inside the bound subtree — the grant adds surface, it does not replace it', async () => {
    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: CHILD, content: 'ordinary child' });

    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledTimes(1);
  });

  it('refuses an add-child under a hyperlink inside the bound subtree too, matching the guards everywhere else', async () => {
    const made = makeDeps({ debriefDestinationId: FINDINGS });
    const state = makeState({ debriefDestinationId: FINDINGS });
    state.nodes[CHILD] = { ...state.nodes[CHILD], metadata: { isHyperlink: true, linkedNodeId: BOUND } };
    made.deps.treeReader.readState = vi.fn(async (_sessionId: string, nodeId: string) =>
      state.nodes[nodeId] ? okRead(state) : ({ kind: 'node-not-in-open-store' } as const),
    );
    made.registry.register('sess-1', BOUND);
    const scopedTools = createWriteTools(made.deps);

    const result = await scopedTools.addChildNode({ sessionId: 'sess-1', parent_id: CHILD, content: 'under a link' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/hyperlink/i);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('refuses an add-child under an external link as well, which the renderer guards always pair with isHyperlink', async () => {
    const made = makeDeps({ debriefDestinationId: FINDINGS });
    const state = makeState({ debriefDestinationId: FINDINGS });
    state.nodes[CHILD] = { ...state.nodes[CHILD], metadata: { isExternalLink: true, externalUrl: 'https://example.com' } };
    made.deps.treeReader.readState = vi.fn(async (_sessionId: string, nodeId: string) =>
      state.nodes[nodeId] ? okRead(state) : ({ kind: 'node-not-in-open-store' } as const),
    );
    made.registry.register('sess-1', BOUND);
    const scopedTools = createWriteTools(made.deps);

    const result = await scopedTools.addChildNode({ sessionId: 'sess-1', parent_id: CHILD, content: 'under a link' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('refuses an add-child whose parent is a back-link, so nothing accumulates beneath the evidence', async () => {
    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: BACKLINK, content: 'nested under a link' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('refuses an add-child targeting a node in neither the bound nor the granted subtree', async () => {
    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: SIBLING, content: 'stray write' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('refuses an add-child targeting a parent id that resolves to no node', async () => {
    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: DANGLING, content: 'nowhere' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });
});

describe('debrief grant — keyed on kind as well as target', () => {
  let made: ReturnType<typeof makeDeps>;
  let tools: WriteTools;

  beforeEach(() => {
    vi.clearAllMocks();
    const bound = bind({ debriefDestinationId: FINDINGS });
    made = bound.made;
    tools = bound.tools;
  });

  it('refuses mark_step_complete against a finding, so the session cannot retire one', async () => {
    const result = await tools.markStepComplete({ sessionId: 'sess-1', status: 'completed', node_id: FINDING_A });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('refuses a move into the granted subtree, so the session cannot reorder findings', async () => {
    const result = await tools.moveNode({ sessionId: 'sess-1', new_parent_id: FINDINGS });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('refuses a delete on a step that carries a debrief destination, exactly as it would without one', async () => {
    const result = await tools.deleteNode({ sessionId: 'sess-1' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('refuses set_node_metadata, so the session cannot forge a back-link or a findings root', async () => {
    const result = await tools.setNodeMetadata({ sessionId: 'sess-1', key: 'linkedNodeId', value: BOUND });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });
});

describe('debrief grant — independent of the context-mode table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies the write under a collaborate-only context, where the mode table permits no direct apply', async () => {
    const { tools, made } = bind({ execute: false, debriefDestinationId: FINDINGS });

    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: FINDINGS, content: 'A new finding' });

    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledTimes(1);
  });

  it('applies the write under an execute-only context', async () => {
    const { tools, made } = bind({ collaborate: false, debriefDestinationId: FINDINGS });

    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: FINDINGS, content: 'A new finding' });

    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledTimes(1);
  });

  it('leaves the mode table intact: a collaborate-only step still cannot add a child inside its own bound subtree', async () => {
    const { tools, made } = bind({ execute: false, debriefDestinationId: FINDINGS });

    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: CHILD, content: 'mid-run note' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });
});

describe('debrief grant — only where a destination is configured, and only on the direct-apply route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses the same write when the step carries no debrief destination', async () => {
    const { tools, made } = bind({});

    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: FINDINGS, content: 'A new finding' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('refuses a write into a subtree the step does not point at', async () => {
    const { tools, made } = bind({ debriefDestinationId: FINDING_A });

    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: FINDINGS, content: 'above the grant' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('refuses the write when the configured destination resolves to no node', async () => {
    const { tools, made } = bind({ debriefDestinationId: DANGLING });

    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: DANGLING, content: 'into the void' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('does not direct-apply on a manual step: the write is queued as a proposal, as it is today', async () => {
    const { tools, made } = bind({ stepType: 'manual', debriefDestinationId: FINDINGS });

    await tools.addChildNode({ sessionId: 'sess-1', parent_id: FINDINGS, content: 'A new finding' });

    expect(made.mutator.mutate).not.toHaveBeenCalled();
    expect(made.proposalSubmitter.submit).toHaveBeenCalledTimes(1);
  });

  it('does not direct-apply on a checkpoint step either', async () => {
    const { tools, made } = bind({ stepType: 'checkpoint', debriefDestinationId: FINDINGS });

    await tools.addChildNode({ sessionId: 'sess-1', parent_id: FINDINGS, content: 'A new finding' });

    expect(made.mutator.mutate).not.toHaveBeenCalled();
    expect(made.proposalSubmitter.submit).toHaveBeenCalledTimes(1);
  });

  // A grant must not outlive the workflow: RemoveWorkflowCommand clears
  // isWorkflow alone, leaving stepType and the destination on the ex-step, and
  // the prompt-side resolver already requires the full shape.
  it('refuses the write once the workflow declaration is gone from the step ancestry', async () => {
    const made = makeDeps({ debriefDestinationId: FINDINGS });
    const state = makeState({ debriefDestinationId: FINDINGS });
    delete state.nodes[WORKFLOW].metadata.isWorkflow;
    made.deps.treeReader.readState = vi.fn(async (_sessionId: string, nodeId: string) =>
      state.nodes[nodeId] ? okRead(state) : ({ kind: 'node-not-in-open-store' } as const),
    );
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: FINDINGS, content: 'A new finding' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  // The grant does not reach past the no-context refusal: write authority has to
  // trace to a declared context, and a bound session on a context-less node is
  // an inconsistent state to refuse rather than fall back from. The send path
  // makes the mistake visible instead, omitting the register and warning, so the
  // session is never handed a debrief it cannot land.
  it('refuses the write when the subject resolves no applied context', async () => {
    const made = makeDeps({ debriefDestinationId: FINDINGS });
    const state = makeState({ debriefDestinationId: FINDINGS });
    delete state.nodes[BOUND].metadata.appliedContextId;
    made.deps.treeReader.readState = vi.fn(async (_sessionId: string, nodeId: string) =>
      state.nodes[nodeId] ? okRead(state) : ({ kind: 'node-not-in-open-store' } as const),
    );
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: FINDINGS, content: 'A new finding' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/context/i);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });
});
