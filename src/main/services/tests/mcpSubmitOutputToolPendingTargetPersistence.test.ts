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
import { TreeReadState, TreeReadResult } from '../mcpReadTools';
import { TreeNode } from '../../../shared/types';

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const TARGET = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
const TARGET_2 = 'dddddddd-dddd-dddd-dddd-dddddddddd04';
const CTX = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05';
const BOUND_STEP = '11111111-1111-1111-1111-111111111101';
const TARGET_STEP = '22222222-2222-2222-2222-222222222202';
const TARGET_2_STEP = '33333333-3333-3333-3333-333333333303';

type StepType = 'manual' | 'checkpoint' | 'autonomous';

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

// BOUND / TARGET / TARGET_2 are all SUBJECTS the one-shot target routes
// between. Each sits under its own STEP; autonomy comes from that step's
// stepType, never from the subject itself.
function makeStateWithThreeNodes(
  boundStepType: StepType | undefined,
  targetStepType: StepType | undefined,
  secondTargetStepType: StepType | undefined,
): TreeReadState {
  const boundStepMeta: TreeNode['metadata'] = {};
  if (boundStepType !== undefined) boundStepMeta.stepType = boundStepType;
  const targetStepMeta: TreeNode['metadata'] = {};
  if (targetStepType !== undefined) targetStepMeta.stepType = targetStepType;
  const target2StepMeta: TreeNode['metadata'] = {};
  if (secondTargetStepType !== undefined) target2StepMeta.stepType = secondTargetStepType;
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [BOUND_STEP, TARGET_STEP, TARGET_2_STEP, CTX]),
      [BOUND_STEP]: makeNode(BOUND_STEP, 'Bound step', [BOUND], boundStepMeta),
      [BOUND]: makeNode(BOUND, 'Bound', [], { appliedContextId: CTX }),
      [TARGET_STEP]: makeNode(TARGET_STEP, 'Target step', [TARGET], targetStepMeta),
      [TARGET]: makeNode(TARGET, 'Target', [], { appliedContextId: CTX }),
      [TARGET_2_STEP]: makeNode(TARGET_2_STEP, 'Target2 step', [TARGET_2], target2StepMeta),
      [TARGET_2]: makeNode(TARGET_2, 'Target2', [], { appliedContextId: CTX }),
      [CTX]: makeNode(CTX, 'Context', [], { isContextDeclaration: true, collaborate: true, execute: false }),
    },
    rootNodeId: ROOT,
    ancestorRegistry: {
      [ROOT]: [],
      [BOUND_STEP]: [ROOT],
      [BOUND]: [ROOT, BOUND_STEP],
      [TARGET_STEP]: [ROOT],
      [TARGET]: [ROOT, TARGET_STEP],
      [TARGET_2_STEP]: [ROOT],
      [TARGET_2]: [ROOT, TARGET_2_STEP],
      [CTX]: [ROOT],
    },
  };
}

function makeToolFor(opts: {
  boundStepType: StepType | undefined;
  targetStepType: StepType | undefined;
  secondTargetStepType?: StepType | undefined;
  bindSession?: boolean;
  pendingTargetNodeId?: string | null;
  applierResult?: { ok: true } | { ok: false; error: string };
  proposalResult?: { ok: true; proposalId: string } | { ok: false; error: string };
}) {
  const registry = new SessionBindingRegistry();
  const applier: StepOutputApplier = {
    apply: vi.fn(async () => opts.applierResult ?? ({ ok: true as const })),
  };
  const oneShotTargetStore = new OneShotTargetStore();
  const treeReader = {
    readState: vi.fn(async (_sessionId: string, nodeId: string): Promise<TreeReadResult> => {
      const state = makeStateWithThreeNodes(opts.boundStepType, opts.targetStepType, opts.secondTargetStepType);
      return state.nodes[nodeId] ? { kind: 'ok', state } : { kind: 'node-not-in-open-store' };
    }),
  };
  const proposalSubmitter = {
    submit: vi.fn(async () => opts.proposalResult ?? ({ ok: true as const, proposalId: 'p' })),
  };
  if (opts.bindSession !== false) registry.register('sess-1', BOUND);
  if (opts.pendingTargetNodeId) oneShotTargetStore.setPendingTarget('sess-1', opts.pendingTargetNodeId);
  const tool = createSubmitOutputTool({
    bindingRegistry: registry,
    treeReader,
    applier,
    oneShotTargetStore,
    proposalSubmitter,
  });
  return { tool, applier, proposalSubmitter, oneShotTargetStore, registry };
}

describe('createSubmitOutputTool — pendingTarget persists across submits (manual collab is multi-shot)', () => {
  // pendingTarget is the MCP-side route for a manual collaboration. It survives
  // multiple successful submits — the renderer signals explicit resolution via
  // markManualCollabResolved on accept / reject / cancel. This mirrors
  // workflow-binding semantics and supports the discuss-then-refresh loop.

  it('preserves pendingTarget after a successful direct apply so the next submit refreshes the same target', async () => {
    const { tool, applier, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
    });

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'first response' });

    expect(applier.apply).toHaveBeenNthCalledWith(1, 'sess-1', TARGET, 'first response');
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'second response' });

    expect(applier.apply).toHaveBeenNthCalledWith(2, 'sess-1', TARGET, 'second response');
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET);
  });

  it('preserves pendingTarget after a successful proposal submission so the next submit refreshes the open panel', async () => {
    const { tool, proposalSubmitter, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET,
    });

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'first proposal' });

    expect(proposalSubmitter.submit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        nodeId: TARGET,
        request: expect.objectContaining({ content: 'first proposal' }),
      }),
    );
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'second proposal' });

    expect(proposalSubmitter.submit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        nodeId: TARGET,
        request: expect.objectContaining({ content: 'second proposal' }),
      }),
    );
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET);
  });

  it('three successive submits all route via the same pendingTarget — full discuss-then-refresh loop', async () => {
    const { tool, proposalSubmitter, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET,
    });

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'v1' });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'v2' });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'v3' });

    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(3);
    expect(proposalSubmitter.submit).toHaveBeenNthCalledWith(1, expect.objectContaining({ nodeId: TARGET }));
    expect(proposalSubmitter.submit).toHaveBeenNthCalledWith(2, expect.objectContaining({ nodeId: TARGET }));
    expect(proposalSubmitter.submit).toHaveBeenNthCalledWith(3, expect.objectContaining({ nodeId: TARGET }));
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET);
  });

  it('does NOT clear pendingTarget when the applier returns an error — the operation has not actually completed', async () => {
    const { tool, applier, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
      applierResult: { ok: false, error: 'apply failed' },
    });

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'first response' });

    expect(applier.apply).toHaveBeenCalledWith('sess-1', TARGET, 'first response');
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET);
  });

  it('does NOT clear pendingTarget when the proposal submitter returns an error — the response has not landed', async () => {
    const { tool, proposalSubmitter, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET,
      proposalResult: { ok: false, error: 'proposal rejected' },
    });

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'first response' });

    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: TARGET }),
    );
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET);
  });

  it('preserves pendingTarget on the unbound-fallback path too — manual route persists even with no workflow binding', async () => {
    // A manual send into a terminal that has no workflow binding still
    // produces a usable route. Successive MCP submits within the open
    // panel must continue to land on the same node until the renderer
    // explicitly resolves the manual collab.
    const { tool, applier, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      bindSession: false,
      pendingTargetNodeId: TARGET,
    });

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'first response' });

    expect(applier.apply).toHaveBeenCalledWith('sess-1', TARGET, 'first response');
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET);

    const second = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'second response' });
    const payload = JSON.parse(second.content[0].text);
    expect(payload.applied).toBe(true);
    expect(applier.apply).toHaveBeenNthCalledWith(2, 'sess-1', TARGET, 'second response');
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET);
  });

  it('routing is per-session — a sess-1 submission does not affect sess-2 pendingTarget', async () => {
    const { tool, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
    });
    oneShotTargetStore.setPendingTarget('sess-2', TARGET_2);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'x' });

    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET);
    expect(oneShotTargetStore.pendingTarget('sess-2')).toBe(TARGET_2);
  });

  it('safety-net firing against a non-autonomous pendingTarget exits as a no-op and preserves the target', async () => {
    // A stray Stop-hook safety-net submission must no-op against an open
    // manual panel rather than silently land arbitrary content, and the
    // route must remain intact so the next explicit submit can refresh
    // the panel.
    const { tool, applier, proposalSubmitter, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET,
    });
    oneShotTargetStore.setMarkerSeenThisTurn('sess-1', true);

    const result = await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'safety-net firing',
      origin: 'safety-net',
    });

    const payload = JSON.parse(result.content[0].text);
    expect(payload.applied).toBe(false);
    expect(payload.reason).toMatch(/safety-net/i);
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).not.toHaveBeenCalled();
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET);
  });

  it('explicit resolution by the renderer clears pendingTarget — the next submit falls back to the workflow binding', async () => {
    // The renderer fires `markManualCollabResolved` on accept / reject /
    // cancel, dropping the manual route. From that point on, follow-up
    // submits behave as if the manual send had never happened: they fall
    // through to whatever workflow binding (or nothing) exists.
    const { tool, applier, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
    });

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'first response' });
    expect(applier.apply).toHaveBeenNthCalledWith(1, 'sess-1', TARGET, 'first response');

    oneShotTargetStore.markManualCollabResolved('sess-1');
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(null);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'after resolve' });
    expect(applier.apply).toHaveBeenNthCalledWith(2, 'sess-1', BOUND, 'after resolve');
  });

  it('manual route on the same node as the workflow binding — refreshes via pendingTarget while open, falls through to binding (same node) after resolve', async () => {
    // AC3 third session shape: the user manually sends to the same node the
    // workflow already binds. Successive submits during the open panel route
    // via pendingTarget; after resolve, pendingTarget clears and routing
    // falls through to the binding — which resolves to the same node.
    const { tool, applier, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      pendingTargetNodeId: BOUND,
    });

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'first' });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'refresh' });

    expect(applier.apply).toHaveBeenNthCalledWith(1, 'sess-1', BOUND, 'first');
    expect(applier.apply).toHaveBeenNthCalledWith(2, 'sess-1', BOUND, 'refresh');
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(BOUND);

    oneShotTargetStore.markManualCollabResolved('sess-1');
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(null);

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'after resolve' });
    expect(applier.apply).toHaveBeenNthCalledWith(3, 'sess-1', BOUND, 'after resolve');
  });

  it('explicit resolution with no binding leaves the session fully unbound — next submit returns unbound', async () => {
    const { tool, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      bindSession: false,
      pendingTargetNodeId: TARGET,
    });

    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'first response' });
    oneShotTargetStore.markManualCollabResolved('sess-1');

    const second = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'after resolve' });
    const payload = JSON.parse(second.content[0].text);
    expect(payload.applied).toBe(false);
    expect(payload.reason).toMatch(/unbound/i);
  });

  it('a fresh manual send (new register-target target) replaces an in-flight manual route — last write wins', async () => {
    // While a manual collab is open and pendingTarget=TARGET, a user issuing
    // a new manual send fires register-target with TARGET_2. The new route
    // must win — subsequent MCP submits land on TARGET_2, not TARGET.
    const { tool, proposalSubmitter, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      secondTargetStepType: 'manual',
      pendingTargetNodeId: TARGET,
    });

    // Manual-route submissions: gate 4 is bypassed (server isAutomatic=false
    // routes via proposalSubmitter before the token check would run), so no
    // targetNodeId is needed or sent.
    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'first to TARGET' });
    expect(proposalSubmitter.submit).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ nodeId: TARGET }),
    );

    oneShotTargetStore.setPendingTarget('sess-1', TARGET_2);

    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'first to TARGET_2' });
    expect(proposalSubmitter.submit).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ nodeId: TARGET_2 }),
    );
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET_2);
  });
});

describe('createSubmitOutputTool — visible signal on routing failure', () => {
  // Today the tool returns {applied:false, reason:"unbound — session has
  // no binding"}; Claude sees the reason but the renderer sees nothing.
  // The renderer-visible surface is undecided so these are placeholders.

  it.todo('emits a renderer-visible signal when neither pendingTarget nor binding exists for the session');
  it.todo('emits a renderer-visible signal when the resolved target node has been deleted from the tree');
  it.todo('explicit (non-safety-net) submissions that cannot be routed surface their reason to the user, not just the Claude session');
});
