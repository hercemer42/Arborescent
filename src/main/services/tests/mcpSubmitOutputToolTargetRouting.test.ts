import { describe, it, expect, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import {
  createSubmitOutputTool,
  StepOutputApplier,
} from '../mcpSubmitOutputTool';
import { OneShotTargetStore } from '../oneShotTargetStore';
import { TreeReadState } from '../mcpReadTools';
import { TreeNode } from '../../../shared/types';

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const TARGET = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
const BOUND_STEP = 'dddddddd-dddd-dddd-dddd-dddddddddd04';
const TARGET_STEP = 'ffffffff-ffff-ffff-ffff-ffffffffff06';
const CTX = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05';

type StepType = 'manual' | 'checkpoint' | 'autonomous';

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

// BOUND and TARGET are both SUBJECTS (the one-shot target routes between them).
// Each sits under its own STEP, and autonomy is decided by that step's
// stepType — subjects never carry stepType themselves.
function makeStateWithTwoNodes(
  boundStepType: StepType | undefined,
  targetStepType: StepType | undefined,
): TreeReadState {
  const boundStepMeta: TreeNode['metadata'] = {};
  if (boundStepType !== undefined) boundStepMeta.stepType = boundStepType;
  const targetStepMeta: TreeNode['metadata'] = {};
  if (targetStepType !== undefined) targetStepMeta.stepType = targetStepType;
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [BOUND_STEP, TARGET_STEP, CTX]),
      [BOUND_STEP]: makeNode(BOUND_STEP, 'Bound step', [BOUND], boundStepMeta),
      [BOUND]: makeNode(BOUND, 'Bound', [], { appliedContextId: CTX }),
      [TARGET_STEP]: makeNode(TARGET_STEP, 'Target step', [TARGET], targetStepMeta),
      [TARGET]: makeNode(TARGET, 'Target', [], { appliedContextId: CTX }),
      [CTX]: makeNode(CTX, 'Context', [], { isContextDeclaration: true, collaborate: true, execute: false }),
    },
    rootNodeId: ROOT,
    ancestorRegistry: {
      [ROOT]: [],
      [BOUND_STEP]: [ROOT],
      [BOUND]: [ROOT, BOUND_STEP],
      [TARGET_STEP]: [ROOT],
      [TARGET]: [ROOT, TARGET_STEP],
      [CTX]: [ROOT],
    },
  };
}

function makeToolFor(opts: {
  boundStepType: StepType | undefined;
  targetStepType: StepType | undefined;
  bindSession?: boolean;
  pendingTargetNodeId?: string | null;
  markerSeen?: boolean;
}) {
  const registry = new SessionBindingRegistry();
  const applier: StepOutputApplier = { apply: vi.fn(async () => ({ ok: true as const })) };
  const oneShotTargetStore = new OneShotTargetStore();
  const treeReader = {
    readState: vi.fn(async () => makeStateWithTwoNodes(opts.boundStepType, opts.targetStepType)),
  };
  const proposalSubmitter = {
    submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })),
  };
  if (opts.bindSession !== false) registry.register('sess-1', BOUND);
  if (opts.pendingTargetNodeId) oneShotTargetStore.setPendingTarget('sess-1', opts.pendingTargetNodeId);
  if (opts.markerSeen !== undefined) oneShotTargetStore.setMarkerSeenThisTurn('sess-1', opts.markerSeen);
  const tool = createSubmitOutputTool({
    bindingRegistry: registry,
    treeReader,
    applier,
    oneShotTargetStore,
    proposalSubmitter,
  });
  return { tool, applier, proposalSubmitter, oneShotTargetStore };
}

describe('createSubmitOutputTool — one-shot target overrides the binding (US-B)', () => {
  // The whole point of US-B: a freeform/manual send sets a per-turn target so
  // its response lands on the intended node WITHOUT touching the workflow
  // binding. Effective destination = pendingTarget ?? binding.

  it('routes submit content to pendingTarget when one is set, NOT to the binding', async () => {
    const { tool, applier } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'freeform response' });
    expect(applier.apply).toHaveBeenCalledWith(TARGET, 'freeform response');
    expect(applier.apply).not.toHaveBeenCalledWith(BOUND, 'freeform response');
  });

  it('falls back to the binding when pendingTarget is null (existing workflow flow unchanged)', async () => {
    const { tool, applier } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      pendingTargetNodeId: null,
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'workflow response' });
    expect(applier.apply).toHaveBeenCalledWith(BOUND, 'workflow response');
  });

  it('a one-shot target routes the response even when the session has NO binding', async () => {
    // Business rule: "A one-shot target applies regardless of whether the
    // session is currently bound." Manual collab into an unbound terminal
    // still lands on the target.
    const { tool, applier } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      bindSession: false,
      pendingTargetNodeId: TARGET,
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'freeform response' });
    expect(applier.apply).toHaveBeenCalledWith(TARGET, 'freeform response');
  });

  it('autonomous-vs-non-automatic gate reads the TARGET node stepType, not the binding stepType', async () => {
    // Acceptance: a freeform collab onto a manual node from a session bound
    // to an autonomous node must NOT auto-apply — it must route through the
    // proposal submitter against the target.
    const { tool, applier, proposalSubmitter } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET,
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'x' });
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: TARGET }),
    );
  });

  it('autonomous binding with a manual target routes through the proposal submitter against the target', async () => {
    const { tool, proposalSubmitter } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET,
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'x' });
    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'sess-1', nodeId: TARGET }),
    );
  });

  it('manual binding with an autonomous target — auto-applies against the target', async () => {
    // The mirror case: workflow's binding is on a manual step (waiting for
    // user confirmation), but a freeform send to an autonomous target should
    // still auto-apply on that target.
    const { tool, applier } = makeToolFor({
      boundStepType: 'manual',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'x' });
    expect(applier.apply).toHaveBeenCalledWith(TARGET, 'x');
  });

  it('a one-shot target that points to a node missing from the tree returns an orphan-style error', async () => {
    const registry = new SessionBindingRegistry();
    registry.register('sess-1', BOUND);
    const oneShotTargetStore = new OneShotTargetStore();
    oneShotTargetStore.setPendingTarget('sess-1', 'unknown-target-node');
    const applier: StepOutputApplier = { apply: vi.fn(async () => ({ ok: true as const })) };
    const tool = createSubmitOutputTool({
      bindingRegistry: registry,
      treeReader: { readState: vi.fn(async () => makeStateWithTwoNodes('autonomous', 'autonomous')) },
      applier,
      oneShotTargetStore,
      proposalSubmitter: { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) },
    });

    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'x' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not found|orphan/i);
    expect(applier.apply).not.toHaveBeenCalled();
  });
});

describe('createSubmitOutputTool — Stop-hook safety net is universally no-op (completion requires explicit submit)', () => {
  // Business rule: completion is gated on an explicit submit_step_output
  // call. The Stop-hook safety net is no longer a content-application
  // fallback — it returns a no-op regardless of markerSeenThisTurn,
  // pendingTarget, or step type.

  function gateScenario(opts: { markerSeen: boolean; pendingTargetNodeId?: string | null }) {
    return makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      markerSeen: opts.markerSeen,
      pendingTargetNodeId: opts.pendingTargetNodeId ?? null,
    });
  }

  it('safety-net origin returns no-op (applied=false) when markerSeenThisTurn is false on an autonomous step', async () => {
    const { tool, applier } = gateScenario({ markerSeen: false });
    const result = await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'last assistant text',
      origin: 'safety-net',
    });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).not.toHaveBeenCalled();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.applied).toBe(false);
    expect(payload.reason).toMatch(/safety-net no-op|explicit submit_step_output required/i);
  });

  it('safety-net origin remains a no-op even when markerSeenThisTurn is true — completion is now gated on explicit submit', async () => {
    const { tool, applier } = gateScenario({ markerSeen: true });
    await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'last assistant text',
      origin: 'safety-net',
    });
    expect(applier.apply).not.toHaveBeenCalled();
  });

  it('safety-net is a no-op when an explicit pendingTarget is set — pendingTarget survives so a subsequent explicit submit still lands', async () => {
    // pendingTarget must survive the safety-net turn so the next explicit
    // submit_step_output still routes to the user's chosen node.
    const { tool, applier, proposalSubmitter, oneShotTargetStore } = gateScenario({
      markerSeen: false,
      pendingTargetNodeId: TARGET,
    });
    const result = await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'x',
      origin: 'safety-net',
    });
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).not.toHaveBeenCalled();
    expect(result.isError).toBeFalsy();
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET);
  });

  it('explicit origin is NOT gated — when Claude calls submit_step_output explicitly the workflow asked for it', async () => {
    const { tool, applier } = gateScenario({ markerSeen: false });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'explicit response' });
    expect(applier.apply).toHaveBeenCalledWith(BOUND, 'explicit response');
  });
});
