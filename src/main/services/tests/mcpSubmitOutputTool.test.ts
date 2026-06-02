import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import {
  createSubmitOutputTool,
  SubmitOutputTool,
  StepOutputApplier,
} from '../mcpSubmitOutputTool';
import { OneShotTargetStore } from '../oneShotTargetStore';
import { TreeReadState } from '../mcpReadTools';
import { TreeNode } from '../../../shared/types';

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const STEP = 'dddddddd-dddd-dddd-dddd-dddddddddd04';
const CTX = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05';

type StepType = 'manual' | 'checkpoint' | 'autonomous';

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

// The session binds to the SUBJECT (BOUND), which travels through the
// workflow; its parent is the current STEP carrying the stepType. The subject
// never carries stepType itself.
function makeState(stepType: StepType | undefined): TreeReadState {
  const stepMetadata: TreeNode['metadata'] = {};
  if (stepType !== undefined) stepMetadata.stepType = stepType;
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [STEP, CTX]),
      [STEP]: makeNode(STEP, 'Step', [BOUND], stepMetadata),
      [BOUND]: makeNode(BOUND, 'Bound', [], { appliedContextId: CTX }),
      [CTX]: makeNode(CTX, 'Context', [], { isContextDeclaration: true, collaborate: true, execute: false }),
    },
    rootNodeId: ROOT,
    ancestorRegistry: { [ROOT]: [], [STEP]: [ROOT], [BOUND]: [ROOT, STEP], [CTX]: [ROOT] },
  };
}

function makeDeps(stepType: StepType | undefined) {
  const registry = new SessionBindingRegistry();
  const applier: StepOutputApplier = {
    apply: vi.fn(async () => ({ ok: true as const })),
  };
  const treeReader = { readState: vi.fn(async () => makeState(stepType)) };
  const oneShotTargetStore = new OneShotTargetStore();
  let nextProposalId = 1;
  const proposalSubmitter = {
    submit: vi.fn(async () => ({ ok: true as const, proposalId: `prop-${nextProposalId++}` })),
  };
  return {
    registry,
    applier,
    treeReader,
    oneShotTargetStore,
    proposalSubmitter,
    deps: { bindingRegistry: registry, treeReader, applier, oneShotTargetStore, proposalSubmitter },
  };
}

describe('createSubmitOutputTool — automatic step writes directly to the node', () => {
  let tool: SubmitOutputTool;
  let applier: StepOutputApplier;

  beforeEach(() => {
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    tool = createSubmitOutputTool(made.deps);
    applier = made.applier;
  });

  it('applies the submitted content to the bound node and reports applied=true', async () => {
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'AI response' });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text)).toEqual({ applied: true });
    expect(applier.apply).toHaveBeenCalledWith('sess-1', BOUND, 'AI response');
  });

  it('an empty content string still triggers an apply — empty is a valid AI response', async () => {
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: '' });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).toHaveBeenCalledWith('sess-1', BOUND, '');
  });
});

describe('createSubmitOutputTool — repeated submits in one session each go through (no dedup)', () => {
  // Iterating on feedback by challenging the AI in the terminal must allow
  // multiple submit_step_output calls per session. Each call refreshes the
  // panel (manual/checkpoint) or rewrites the node (autonomous).
  it('a second autonomous submit calls the applier again with the new content', async () => {
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    const tool = createSubmitOutputTool(made.deps);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'first' });
    const second = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'second' });

    expect(second.isError).toBeFalsy();
    expect(JSON.parse(second.content[0].text)).toEqual({ applied: true });
    expect(made.applier.apply).toHaveBeenNthCalledWith(1, 'sess-1', BOUND, 'first');
    expect(made.applier.apply).toHaveBeenNthCalledWith(2, 'sess-1', BOUND, 'second');
  });

  it('a second manual-step submit queues another proposal so the feedback panel can refresh', async () => {
    const made = makeDeps('manual');
    made.registry.register('sess-1', BOUND);
    const tool = createSubmitOutputTool(made.deps);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'draft' });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'revised' });

    expect(made.proposalSubmitter.submit).toHaveBeenCalledTimes(2);
  });
});

describe('createSubmitOutputTool — step-type gate routes non-automatic to the proposal submitter (PR7)', () => {
  function withStepType(stepType: StepType | undefined) {
    const made = makeDeps(stepType);
    made.registry.register('sess-1', BOUND);
    made.oneShotTargetStore.setMarkerSeenThisTurn('sess-1', true);
    return {
      tool: createSubmitOutputTool(made.deps),
      applier: made.applier,
      proposalSubmitter: made.proposalSubmitter,
    };
  }

  it('manual step does NOT apply directly and routes the content to the proposal submitter', async () => {
    const { tool, applier, proposalSubmitter } = withStepType('manual');
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'manual response' });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
    expect(proposalSubmitter.submit).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      nodeId: BOUND,
      request: { kind: 'submit-step-output', content: 'manual response' },
    });
    const payload = JSON.parse(result.content[0].text);
    expect(payload.applied).toBe(false);
    expect(payload.proposed).toBe(true);
    expect(payload.proposalId).toEqual(expect.any(String));
  });

  it('checkpoint step also routes to the proposal submitter', async () => {
    const { tool, applier, proposalSubmitter } = withStepType('checkpoint');
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'checkpoint response' });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
  });

  it('a node with no stepType set is treated as non-automatic and routed to the proposal submitter', async () => {
    const { tool, applier, proposalSubmitter } = withStepType(undefined);
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x' });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
  });

  it('a proposal-submitter failure surfaces as an error', async () => {
    const { tool, proposalSubmitter } = withStepType('manual');
    (proposalSubmitter.submit as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      ok: false,
      error: 'no store for bound file',
    }));
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('no store for bound file');
  });

  it('autonomous step still goes through the applier (NOT the proposal submitter)', async () => {
    const { tool, applier, proposalSubmitter } = withStepType('autonomous');
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'auto' });
    expect(applier.apply).toHaveBeenCalledTimes(1);
    expect(proposalSubmitter.submit).not.toHaveBeenCalled();
  });

  it('safety-net origin on a non-automatic step is a no-op (does NOT queue a proposal)', async () => {
    // Stop-hook auto-submits content speculatively. For non-automatic steps the
    // user is in the loop and will submit explicitly — manufacturing a proposal
    // per turn would pile up entries the user did not ask for.
    const { tool, proposalSubmitter } = withStepType('manual');
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x', origin: 'safety-net' });
    expect(result.isError).toBeFalsy();
    expect(proposalSubmitter.submit).not.toHaveBeenCalled();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.applied).toBe(false);
    expect(payload.reason).toMatch(/safety-net/i);
  });

  it('safety-net origin on an autonomous step is also a no-op — completion requires an explicit submit', async () => {
    // Completion is gated on an explicit submit_step_output call. The Stop-hook
    // safety net no longer auto-applies content on autonomous steps either;
    // otherwise a turn that ended without the AI calling submit_step_output
    // would still corrupt the bound node with the transcript's last message.
    const { tool, applier } = withStepType('autonomous');
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'auto', origin: 'safety-net' });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).not.toHaveBeenCalled();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.applied).toBe(false);
    expect(payload.reason).toMatch(/safety-net/i);
  });

  it('explicit origin (default) on a non-automatic step continues to queue a proposal', async () => {
    const { tool, proposalSubmitter } = withStepType('manual');
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x' });
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
  });
});

describe('createSubmitOutputTool — unbound session is a graceful no-op (not an error)', () => {
  it('submit_step_output for an unknown session returns ok with applied=false, reason=unbound', async () => {
    const made = makeDeps('autonomous');
    // do NOT register sess-1
    const tool = createSubmitOutputTool(made.deps);

    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'orphan response' });

    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.applied).toBe(false);
    expect(payload.reason).toMatch(/unbound|no binding|not bound/i);
    // AC2 (Ticket B): the reason names the likely real cause (target marker / no binding) rather than a bare "unbound"
    expect(payload.reason).toMatch(/target|marker/i);
    expect(made.applier.apply).not.toHaveBeenCalled();
  });

  it('does NOT call the tree reader for an unbound session (no wasted IPC round trip)', async () => {
    const made = makeDeps('autonomous');
    const tool = createSubmitOutputTool(made.deps);
    await tool.submitStepOutput({ sessionId: 'sess-unknown', targetNodeId: BOUND, content: 'x' });
    expect(made.treeReader.readState).not.toHaveBeenCalled();
  });
});

describe('createSubmitOutputTool — error propagation', () => {
  it('an orphan binding (node missing from tree) returns a descriptive error', async () => {
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', 'unknown-node');
    const tool = createSubmitOutputTool(made.deps);

    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not found|orphan/i);
    expect(made.applier.apply).not.toHaveBeenCalled();
  });

  it('tree state unavailable returns a descriptive error', async () => {
    const registry = new SessionBindingRegistry();
    const applier: StepOutputApplier = { apply: vi.fn(async () => ({ ok: true as const })) };
    const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) };
    const tool = createSubmitOutputTool({
      bindingRegistry: registry,
      treeReader: { readState: async () => null },
      applier,
      oneShotTargetStore: new OneShotTargetStore(),
      proposalSubmitter,
    });
    registry.register('sess-1', BOUND);

    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x' });

    expect(result.isError).toBe(true);
    expect(applier.apply).not.toHaveBeenCalled();
  });

  it('an applier returning ok=false surfaces the error message and marks isError', async () => {
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    (made.applier.apply as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      ok: false,
      error: 'renderer rejected: collaborating node mismatch',
    }));
    const tool = createSubmitOutputTool(made.deps);

    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('collaborating node mismatch');
  });
});

describe('createSubmitOutputTool — bound working-node under an autonomous step applies directly', () => {
  const WORKFLOW = 'wwwwwwww-wwww-wwww-wwww-wwwwwwwwww09';
  const STEP = 'ssssssss-ssss-ssss-ssss-ssssssssss08';
  const WORKING = 'wwwwwwww-wwww-wwww-wwww-wwwwwwwwww10';

  function makeWorkflowState(stepType: StepType | undefined): TreeReadState {
    const stepMetadata: TreeNode['metadata'] = {};
    if (stepType !== undefined) stepMetadata.stepType = stepType;
    return {
      nodes: {
        [ROOT]: makeNode(ROOT, 'Root', [WORKFLOW]),
        [WORKFLOW]: makeNode(WORKFLOW, 'Workflow', [STEP], { isWorkflow: true }),
        [STEP]: makeNode(STEP, 'Step', [WORKING], stepMetadata),
        [WORKING]: makeNode(WORKING, 'Working node content', []),
      },
      rootNodeId: ROOT,
      ancestorRegistry: {
        [ROOT]: [],
        [WORKFLOW]: [ROOT],
        [STEP]: [ROOT, WORKFLOW],
        [WORKING]: [ROOT, WORKFLOW, STEP],
      },
    };
  }

  function setupTool(stepType: StepType | undefined) {
    const registry = new SessionBindingRegistry();
    const applier: StepOutputApplier = { apply: vi.fn(async () => ({ ok: true as const })) };
    const treeReader = { readState: async () => makeWorkflowState(stepType) };
    const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) };
    registry.register('sess-1', WORKING);
    return {
      tool: createSubmitOutputTool({ bindingRegistry: registry, treeReader, applier, oneShotTargetStore: new OneShotTargetStore(), proposalSubmitter }),
      applier,
      proposalSubmitter,
    };
  }

  it('working node under stepType=autonomous applies directly (no proposal panel)', async () => {
    const { tool, applier, proposalSubmitter } = setupTool('autonomous');
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: WORKING, content: 'autonomous result' });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).toHaveBeenCalledWith('sess-1', WORKING, 'autonomous result');
    expect(proposalSubmitter.submit).not.toHaveBeenCalled();
  });

  it('working node under stepType=manual still routes to the proposal submitter', async () => {
    const { tool, applier, proposalSubmitter } = setupTool('manual');
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: WORKING, content: 'manual result' });
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
  });

  it('working node under stepType=checkpoint still routes to the proposal submitter', async () => {
    const { tool, applier, proposalSubmitter } = setupTool('checkpoint');
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: WORKING, content: 'checkpoint result' });
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
  });

  it('working node under a parent with no stepType still routes to the proposal submitter', async () => {
    const { tool, applier, proposalSubmitter } = setupTool(undefined);
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: WORKING, content: 'x' });
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
  });
});

describe('createSubmitOutputTool — mode-agnostic on automatic steps', () => {
  function makeStateWithFlags(collaborate: boolean, execute: boolean): TreeReadState {
    return {
      nodes: {
        [ROOT]: makeNode(ROOT, 'Root', [STEP, CTX]),
        [STEP]: makeNode(STEP, 'Step', [BOUND], { stepType: 'autonomous' }),
        [BOUND]: makeNode(BOUND, 'Bound', [], { appliedContextId: CTX }),
        [CTX]: makeNode(CTX, 'Context', [], { isContextDeclaration: true, collaborate, execute }),
      },
      rootNodeId: ROOT,
      ancestorRegistry: { [ROOT]: [], [STEP]: [ROOT], [BOUND]: [ROOT, STEP], [CTX]: [ROOT] },
    };
  }

  function makeToolFor(collaborate: boolean, execute: boolean) {
    const registry = new SessionBindingRegistry();
    const applier: StepOutputApplier = { apply: vi.fn(async () => ({ ok: true as const })) };
    const treeReader = { readState: async () => makeStateWithFlags(collaborate, execute) };
    registry.register('sess-1', BOUND);
    const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) };
    return {
      tool: createSubmitOutputTool({ bindingRegistry: registry, treeReader, applier, oneShotTargetStore: new OneShotTargetStore(), proposalSubmitter }),
      applier,
    };
  }

  it('collaborate-only mode allows submit_step_output on an automatic step', async () => {
    const { tool, applier } = makeToolFor(true, false);
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x' });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).toHaveBeenCalled();
  });

  it('execute-only mode allows submit_step_output on an automatic step (this is the output channel, not a tree-mutation)', async () => {
    const { tool, applier } = makeToolFor(false, true);
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x' });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).toHaveBeenCalled();
  });

  it('collaborate+execute mode allows submit_step_output on an automatic step', async () => {
    const { tool, applier } = makeToolFor(true, true);
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x' });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).toHaveBeenCalled();
  });
});

describe('createSubmitOutputTool — explicit-submit gate flag (Stop-hook completion gate)', () => {
  // The explicit-submit flag is the positive completion signal for the
  // Stop-hook gate: when set, the Stop hook is allowed to advance the
  // bound autonomous step; when clear, Stop is a no-op even on autonomous
  // steps. The flag is per-session, scoped to the current turn, and is
  // set ONLY by explicit submissions — safety-net submissions must not
  // raise it, since they fire on every assistant turn boundary regardless
  // of whether the AI actually intended completion.

  it('explicit-origin submit on an autonomous step sets explicitSubmitSeenThisTurn for the session', async () => {
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    const tool = createSubmitOutputTool(made.deps);

    expect(made.oneShotTargetStore.wasExplicitSubmitSeenThisTurn('sess-1')).toBe(false);
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'auto' });
    expect(made.oneShotTargetStore.wasExplicitSubmitSeenThisTurn('sess-1')).toBe(true);
  });

  it('explicit-origin submit on a non-automatic step (proposal route) sets explicitSubmitSeenThisTurn', async () => {
    // The AI's explicit submit is meaningful even on manual/checkpoint
    // steps: it signals "the AI has produced its turn output for the user
    // to review." The Stop-hook gate uses this to decide whether the
    // awaiting-validation transition should fire.
    const made = makeDeps('manual');
    made.registry.register('sess-1', BOUND);
    made.oneShotTargetStore.setMarkerSeenThisTurn('sess-1', true);
    const tool = createSubmitOutputTool(made.deps);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'manual response' });
    expect(made.oneShotTargetStore.wasExplicitSubmitSeenThisTurn('sess-1')).toBe(true);
  });

  it('safety-net-origin submit does NOT set explicitSubmitSeenThisTurn (autonomous)', async () => {
    // Safety-net submissions are the Stop hook auto-submit; they fire on
    // every turn regardless of intent. Letting them raise the flag would
    // make the gate self-defeating — the very Stop event we want to gate
    // would always find the flag set.
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    made.oneShotTargetStore.setMarkerSeenThisTurn('sess-1', true);
    const tool = createSubmitOutputTool(made.deps);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'auto', origin: 'safety-net' });
    expect(made.oneShotTargetStore.wasExplicitSubmitSeenThisTurn('sess-1')).toBe(false);
  });

  it('safety-net-origin submit does NOT set explicitSubmitSeenThisTurn on a non-automatic step (no-op path)', async () => {
    const made = makeDeps('manual');
    made.registry.register('sess-1', BOUND);
    made.oneShotTargetStore.setMarkerSeenThisTurn('sess-1', true);
    const tool = createSubmitOutputTool(made.deps);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x', origin: 'safety-net' });
    expect(made.oneShotTargetStore.wasExplicitSubmitSeenThisTurn('sess-1')).toBe(false);
  });

  it('unbound session does NOT set explicitSubmitSeenThisTurn — no completion can be claimed without a binding', async () => {
    const made = makeDeps('autonomous');
    // do NOT register sess-1
    const tool = createSubmitOutputTool(made.deps);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'orphan' });
    expect(made.oneShotTargetStore.wasExplicitSubmitSeenThisTurn('sess-1')).toBe(false);
  });

  it('safety-net early no-op (no markerSeenThisTurn) does NOT set explicitSubmitSeenThisTurn', async () => {
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    // markerSeenThisTurn intentionally NOT set
    const tool = createSubmitOutputTool(made.deps);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x', origin: 'safety-net' });
    expect(made.oneShotTargetStore.wasExplicitSubmitSeenThisTurn('sess-1')).toBe(false);
  });

  it('flag is set per-session — sess-1 explicit submit does not leak to sess-2', async () => {
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    made.registry.register('sess-2', BOUND);
    const tool = createSubmitOutputTool(made.deps);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x' });
    expect(made.oneShotTargetStore.wasExplicitSubmitSeenThisTurn('sess-1')).toBe(true);
    expect(made.oneShotTargetStore.wasExplicitSubmitSeenThisTurn('sess-2')).toBe(false);
  });

  it('a failed applier.apply leaves explicitSubmitSeenThisTurn unset so the next Stop is correctly gated', async () => {
    // Completion requires both AI intent AND content successfully landing.
    // A failed apply means the content never reached the bound node, so the
    // turn must NOT raise the gate — otherwise the Stop would advance the
    // step on stale content, reintroducing the original bug class.
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    (made.applier.apply as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      ok: false,
      error: 'renderer rejected: collaborating node mismatch',
    }));
    const tool = createSubmitOutputTool(made.deps);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x' });

    expect(made.oneShotTargetStore.wasExplicitSubmitSeenThisTurn('sess-1')).toBe(false);
  });

  it('a failed proposal also leaves explicitSubmitSeenThisTurn unset', async () => {
    const made = makeDeps('manual');
    made.registry.register('sess-1', BOUND);
    made.oneShotTargetStore.setMarkerSeenThisTurn('sess-1', true);
    (made.proposalSubmitter.submit as ReturnType<typeof vi.fn>).mockImplementation(async () => ({
      ok: false,
      error: 'no store for bound file',
    }));
    const tool = createSubmitOutputTool(made.deps);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x' });

    expect(made.oneShotTargetStore.wasExplicitSubmitSeenThisTurn('sess-1')).toBe(false);
  });
});

describe('createSubmitOutputTool — submission logging records origin and applied state', () => {
  it('logs origin=explicit and applied=true on a successful autonomous apply', async () => {
    const { logger } = await import('../logger');
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    const tool = createSubmitOutputTool(made.deps);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x' });

    const logCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[0] as string,
    );
    expect(logCalls.some((msg) => /origin=explicit/.test(msg) && /applied=true/.test(msg))).toBe(true);
  });

  it('logs origin=safety-net and applied=false when the safety-net path no-ops', async () => {
    const { logger } = await import('../logger');
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    made.oneShotTargetStore.setMarkerSeenThisTurn('sess-1', true);
    const tool = createSubmitOutputTool(made.deps);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x', origin: 'safety-net' });

    const logCalls = (logger.info as ReturnType<typeof vi.fn>).mock.calls.map(
      (call) => call[0] as string,
    );
    expect(logCalls.some((msg) => /origin=safety-net/.test(msg) && /applied=false/.test(msg))).toBe(true);
  });
});

