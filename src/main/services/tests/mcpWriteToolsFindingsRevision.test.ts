import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import { createWriteTools, WriteTools, TreeMutator } from '../mcpWriteTools';
import { ToolResult, TreeReadState, TreeReadResult } from '../mcpReadTools';
import { TreeNode } from '../../../shared/types';

// set_node_content gains an optional node id under the story 001 grant, so a
// debrief can revise a finding's wording in place.
//
// Two things make this more than a parameter. set-content has no direct-apply
// route in any mode — collaborate, execute and action permit none, and both
// permits additive kinds only — so every revision lands through the grant's
// mode-policy bypass, which until now turned on a single kind. And the target
// scope check is shared with mark_step_complete's node_id, so widening it must
// key on the request kind or mark_step_complete inherits Findings scope.

type SetNodeContentByNodeId = (args: { sessionId: string; content: string; node_id?: string }) => Promise<ToolResult>;

// The parameter does not exist yet; the cast is the red state, not a shortcut.
function setNodeContent(tools: WriteTools): SetNodeContentByNodeId {
  return tools.setNodeContent as unknown as SetNodeContentByNodeId;
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
const WORKFLOW = '55555555-5555-5555-5555-555555555511';
const DANGLING = '99999999-9999-9999-9999-999999999999';

interface SetupArgs {
  collaborate?: boolean;
  execute?: boolean;
  stepType?: 'manual' | 'checkpoint' | 'autonomous';
  debriefDestinationId?: string;
}

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

function makeState({
  collaborate = true,
  execute = true,
  stepType = 'autonomous',
  debriefDestinationId,
}: SetupArgs): TreeReadState {
  const stepMetadata: TreeNode['metadata'] = { stepType };
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
  const mutator: TreeMutator = { mutate: vi.fn(async () => ({ ok: true as const })) };
  const state = makeState(setup);
  const treeReader = {
    readState: vi.fn(async (_sessionId: string, nodeId: string): Promise<TreeReadResult> =>
      state.nodes[nodeId] ? { kind: 'ok', state } : { kind: 'node-not-in-open-store' },
    ),
  };
  const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'prop-1' })) };
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

describe('set_node_content by node id — revising a finding', () => {
  let made: ReturnType<typeof makeDeps>;
  let tools: WriteTools;

  beforeEach(() => {
    vi.clearAllMocks();
    const bound = bind({ debriefDestinationId: FINDINGS });
    made = bound.made;
    tools = bound.tools;
  });

  it('replaces a description line inside the granted subtree', async () => {
    const result = await setNodeContent(tools)({
      sessionId: 'sess-1',
      node_id: DESCRIPTION,
      content: 'The prompt names no output format, so each session invents one',
    });

    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledTimes(1);
  });

  it('routes the mutation at the named node rather than at the bound node', async () => {
    await setNodeContent(tools)({ sessionId: 'sess-1', node_id: DESCRIPTION, content: 'revised' });

    expect(made.mutator.mutate).toHaveBeenCalledWith('sess-1', DESCRIPTION, expect.objectContaining({ kind: 'set-content' }));
  });

  // The applier attaches evidence for the writes the gate labelled, exactly as
  // it does for an add-child, so a revision is recorded as a recurrence.
  it('labels the revision with the destination it landed in', async () => {
    await setNodeContent(tools)({ sessionId: 'sess-1', node_id: DESCRIPTION, content: 'revised' });

    expect(made.mutator.mutate).toHaveBeenCalledWith(
      'sess-1',
      DESCRIPTION,
      expect.objectContaining({ debriefDestinationId: FINDINGS }),
    );
  });

  // The mutation is routed at the target, so the subject a back-link points at
  // has to travel on the request; an add-child reads it off the node argument.
  it('carries the step subject on the request, since the node argument is spent on the target', async () => {
    await setNodeContent(tools)({ sessionId: 'sess-1', node_id: DESCRIPTION, content: 'revised' });

    expect(made.mutator.mutate).toHaveBeenCalledWith(
      'sess-1',
      DESCRIPTION,
      expect.objectContaining({ subjectNodeId: BOUND }),
    );
  });

  it('leaves an ordinary bound-subtree write unlabelled', async () => {
    await tools.addChildNode({ sessionId: 'sess-1', parent_id: CHILD, content: 'ordinary child' });

    expect(made.mutator.mutate).toHaveBeenCalledWith(
      'sess-1',
      BOUND,
      expect.not.objectContaining({ debriefDestinationId: expect.anything() }),
    );
  });

  // Every reference is by uuid, so renaming a finding breaks no targeting and
  // improving the headline is part of the synthesis.
  it('replaces a finding title', async () => {
    const result = await setNodeContent(tools)({
      sessionId: 'sess-1',
      node_id: FINDING_A,
      content: 'Step prompts leave the output format to the session',
    });

    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledWith('sess-1', FINDING_A, expect.objectContaining({ kind: 'set-content' }));
  });
});

describe('set_node_content by node id — the grant carries it past the mode table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('applies under a collaborate-only context, where the mode table permits no direct apply', async () => {
    const { tools, made } = bind({ execute: false, debriefDestinationId: FINDINGS });

    const result = await setNodeContent(tools)({ sessionId: 'sess-1', node_id: DESCRIPTION, content: 'revised' });

    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledTimes(1);
  });

  it('applies under an execute-and-collaborate context, which permits additive kinds only', async () => {
    const { tools, made } = bind({ debriefDestinationId: FINDINGS });

    const result = await setNodeContent(tools)({ sessionId: 'sess-1', node_id: DESCRIPTION, content: 'revised' });

    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledTimes(1);
  });

  it('leaves the mode table intact: the bound node itself is still refused', async () => {
    const { tools, made } = bind({ debriefDestinationId: FINDINGS });

    const result = await setNodeContent(tools)({ sessionId: 'sess-1', content: 'rewriting my own subject' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  // Autonomous-only is mechanical: on the proposal route the receiver rejects
  // every proposition that is not a submit_step_output, so the grant would
  // authorise a write that cannot land.
  it('does not carry a manual step past the mode table', async () => {
    const { tools, made } = bind({ stepType: 'manual', debriefDestinationId: FINDINGS });

    const result = await setNodeContent(tools)({ sessionId: 'sess-1', node_id: DESCRIPTION, content: 'revised' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
    expect(made.proposalSubmitter.submit).not.toHaveBeenCalled();
  });

  it('still queues a proposal where the mode table already allowed one', async () => {
    const { tools, made } = bind({ stepType: 'manual', execute: false, debriefDestinationId: FINDINGS });

    await setNodeContent(tools)({ sessionId: 'sess-1', node_id: DESCRIPTION, content: 'revised' });

    expect(made.mutator.mutate).not.toHaveBeenCalled();
    expect(made.proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: DESCRIPTION }),
    );
  });
});

describe('set_node_content by node id — refusals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses a target in neither the bound subtree nor the granted Findings subtree', async () => {
    const { tools, made } = bind({ debriefDestinationId: FINDINGS });

    const result = await setNodeContent(tools)({ sessionId: 'sess-1', node_id: SIBLING, content: 'stray write' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  // The evidence a synthesis rests on cannot be rewritten by the synthesis.
  it('refuses a back-link target, so the evidence stays as written', async () => {
    const { tools, made } = bind({ debriefDestinationId: FINDINGS });

    const result = await setNodeContent(tools)({ sessionId: 'sess-1', node_id: BACKLINK, content: 'seen everywhere' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/hyperlink|link/i);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('refuses a target id that resolves to no node', async () => {
    const { tools, made } = bind({ debriefDestinationId: FINDINGS });

    const result = await setNodeContent(tools)({ sessionId: 'sess-1', node_id: DANGLING, content: 'nowhere' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('refuses a node id when the step declares no Findings node', async () => {
    const { tools, made } = bind({});

    const result = await setNodeContent(tools)({ sessionId: 'sess-1', node_id: DESCRIPTION, content: 'revised' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('refuses a node id when the configured destination resolves to no node', async () => {
    const { tools, made } = bind({ debriefDestinationId: DANGLING });

    const result = await setNodeContent(tools)({ sessionId: 'sess-1', node_id: DESCRIPTION, content: 'revised' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  // Replacement with nothing deletes a description line by another route, which
  // the grant is meant to exclude. Whether the gate refuses it or the app keeps
  // the write and lets the user repair it is unsettled.
  it.todo('refuses an empty replacement, which would delete a description line');
});

describe('the widened target check stays keyed on the request kind', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refuses delete_node on a description line: the grant covers replacement only', async () => {
    const { tools, made } = bind({ debriefDestinationId: FINDINGS });

    const result = await tools.deleteNode({ sessionId: 'sess-1' });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('refuses mark_step_complete against a finding even though set_node_content now reaches it', async () => {
    const { tools, made } = bind({ debriefDestinationId: FINDINGS });

    const result = await tools.markStepComplete({ sessionId: 'sess-1', status: 'completed', node_id: FINDING_A });

    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('still marks a node inside the bound subtree complete', async () => {
    const { tools, made } = bind({ debriefDestinationId: FINDINGS });

    const result = await tools.markStepComplete({ sessionId: 'sess-1', status: 'completed', node_id: CHILD });

    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledWith('sess-1', CHILD, expect.objectContaining({ kind: 'mark-complete' }));
  });
});
