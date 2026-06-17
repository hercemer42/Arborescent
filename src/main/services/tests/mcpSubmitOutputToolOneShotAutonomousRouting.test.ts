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

// US3 — close the one-shot/autonomous gating gap. A one-shot manual send
// (pendingTarget armed) whose resolved node is structurally autonomous must
// route to the proposal/feedback panel, never the rebuilding applier. The
// rebuilding applier replaces the bound subtree from the submitted content,
// which destroys out-of-band add_child_node children created earlier in the
// turn — so "applier never invoked" IS the data-loss regression guard at
// this layer.

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

function makeState(boundStepType: StepType, targetStepType: StepType): TreeReadState {
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [BOUND_STEP, TARGET_STEP, CTX]),
      [BOUND_STEP]: makeNode(BOUND_STEP, 'Bound step', [BOUND], { stepType: boundStepType }),
      [BOUND]: makeNode(BOUND, 'Bound', [], { appliedContextId: CTX }),
      [TARGET_STEP]: makeNode(TARGET_STEP, 'Target step', [TARGET], { stepType: targetStepType }),
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

function makeTool(opts: {
  boundStepType: StepType;
  targetStepType: StepType;
  bindSession?: boolean;
  pendingTargetNodeId?: string | null;
  proposalResult?: { ok: true; proposalId: string } | { ok: false; error: string };
}) {
  const registry = new SessionBindingRegistry();
  if (opts.bindSession !== false) registry.register('sess-1', BOUND);
  const applier: StepOutputApplier = { apply: vi.fn(async () => ({ ok: true as const })) };
  const oneShotTargetStore = new OneShotTargetStore();
  if (opts.pendingTargetNodeId) oneShotTargetStore.setPendingTarget('sess-1', opts.pendingTargetNodeId);
  const treeReader = {
    readState: vi.fn(async (_sessionId: string, nodeId: string): Promise<TreeReadResult> => {
      const state = makeState(opts.boundStepType, opts.targetStepType);
      return state.nodes[nodeId] ? { kind: 'ok', state } : { kind: 'node-not-in-open-store' };
    }),
  };
  const proposalSubmitter = {
    submit: vi.fn(async () => opts.proposalResult ?? { ok: true as const, proposalId: 'p' }),
  };
  const tool = createSubmitOutputTool({
    bindingRegistry: registry,
    treeReader,
    applier,
    oneShotTargetStore,
    proposalSubmitter,
  });
  return { tool, applier, proposalSubmitter, oneShotTargetStore };
}

describe('createSubmitOutputTool — one-shot send onto an autonomous target routes to proposal (US3)', () => {
  it('a one-shot send onto a structurally autonomous target routes through the proposal submitter, and the rebuilding applier is never invoked', async () => {
    const { tool, applier, proposalSubmitter } = makeTool({
      boundStepType: 'manual',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
    });
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'one-shot response' });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'sess-1',
        nodeId: TARGET,
        request: expect.objectContaining({ kind: 'submit-step-output', content: 'one-shot response' }),
      }),
    );
  });

  it('the routed send reports proposed=true / applied=false so callers cannot mistake it for a direct apply', async () => {
    const { tool } = makeTool({
      boundStepType: 'manual',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
    });
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'x' });
    const payload = JSON.parse(result.content[0].text);
    expect(payload.applied).toBe(false);
    expect(payload.proposed).toBe(true);
    expect(payload.proposalId).toBe('p');
  });

  it('data-loss regression: a one-shot send onto an autonomous target never reaches the subtree-rebuilding applier, even when both bound and target steps are autonomous', async () => {
    // The exact reported path: session bound under an autonomous step, user
    // fires a one-shot send onto a node under another autonomous step. Before
    // US3 this fell through the !pendingTarget mode-gate guard straight into
    // applier.apply, rebuilding the subtree and dropping out-of-band children.
    const { tool, applier, proposalSubmitter } = makeTool({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'x' });
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: TARGET }),
    );
  });

  it('same-session overlap: a one-shot send targeting the session\'s own bound autonomous node returns proposed, not applied', async () => {
    const { tool, applier, proposalSubmitter } = makeTool({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      pendingTargetNodeId: BOUND,
    });
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x' });
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: BOUND }),
    );
    const payload = JSON.parse(result.content[0].text);
    expect(payload.applied).toBe(false);
    expect(payload.proposed).toBe(true);
  });

  it('an unbound session with a one-shot autonomous target still routes to proposal, never the applier', async () => {
    const { tool, applier, proposalSubmitter } = makeTool({
      boundStepType: 'manual',
      targetStepType: 'autonomous',
      bindSession: false,
      pendingTargetNodeId: TARGET,
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'x' });
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: TARGET }),
    );
  });

  it('repeated one-shot submits in the same turn each re-route to proposal (panel refresh contract), still never the applier', async () => {
    const { tool, applier, proposalSubmitter } = makeTool({
      boundStepType: 'manual',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'draft 1' });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'draft 2' });
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(2);
    expect(proposalSubmitter.submit).toHaveBeenLastCalledWith(
      expect.objectContaining({
        request: expect.objectContaining({ content: 'draft 2' }),
      }),
    );
  });

  it('empty content on the diverted route still goes to proposal — never silently dropped, never applied', async () => {
    const { tool, applier, proposalSubmitter } = makeTool({
      boundStepType: 'manual',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
    });
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: '' });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ request: expect.objectContaining({ content: '' }) }),
    );
  });

  it('the diverted route marks the done-declaration so the turn counts as completed', async () => {
    const { tool, oneShotTargetStore } = makeTool({
      boundStepType: 'manual',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'x' });
    expect(oneShotTargetStore.doneDeclarationNode('sess-1')).toBe(TARGET);
  });
});

describe('createSubmitOutputTool — refusal fallback on the diverted route (US3)', () => {
  it('a proposalSubmitter failure on the diverted route returns a hard error and never falls through to the applier', async () => {
    const { tool, applier } = makeTool({
      boundStepType: 'manual',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
      proposalResult: { ok: false, error: 'proposal channel unavailable' },
    });
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'x' });
    expect(result.isError).toBe(true);
    expect(applier.apply).not.toHaveBeenCalled();
  });

  it('a proposalSubmitter failure on the diverted route does not mark the done-declaration (the turn did not complete)', async () => {
    const { tool, oneShotTargetStore } = makeTool({
      boundStepType: 'manual',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
      proposalResult: { ok: false, error: 'proposal channel unavailable' },
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'x' });
    expect(oneShotTargetStore.doneDeclarationNode('sess-1')).toBeNull();
  });

  // Story 1's error-code vocabulary is not on this branch yet; the exact code
  // for "cannot be safely turned into a proposal" is undecided, so post-fix
  // behavior is uncertain — title only.
  it.todo('the refusal on the diverted route carries the story 1 error code for unroutable proposals');
});

describe('createSubmitOutputTool — drift guard on the diverted route (US3)', () => {
  it('a one-shot autonomous submit whose target_node_id disagrees with the resolved pendingTarget fails loud — no proposal, no apply', async () => {
    const { tool, applier, proposalSubmitter } = makeTool({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
    });
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'x' });
    expect(result.isError).toBe(true);
    expect(proposalSubmitter.submit).not.toHaveBeenCalled();
    expect(applier.apply).not.toHaveBeenCalled();
  });

  // Whether the gate-4 token stays mandatory for autonomous targets on the
  // diverted (proposal) route is an open design decision — the manual proposal
  // branch tolerates a missing token, the autonomous applier route requires
  // it. Title only until decided.
  it.todo('a one-shot autonomous submit with no target_node_id — token requirement on the diverted route');
});

describe('createSubmitOutputTool — non-autonomous routes unchanged (US3 regression guards)', () => {
  it('a one-shot send onto a manual target still routes to proposal exactly as before', async () => {
    const { tool, applier, proposalSubmitter } = makeTool({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET,
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: TARGET, content: 'x' });
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: TARGET }),
    );
  });

  it('a workflow submit (no pendingTarget) on an autonomous bound step still auto-applies via the applier', async () => {
    const { tool, applier, proposalSubmitter } = makeTool({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      pendingTargetNodeId: null,
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'workflow response' });
    expect(applier.apply).toHaveBeenCalledWith('sess-1', BOUND, 'workflow response');
    expect(proposalSubmitter.submit).not.toHaveBeenCalled();
  });

  it('a workflow submit (no pendingTarget) on a manual bound step still routes to proposal', async () => {
    const { tool, applier, proposalSubmitter } = makeTool({
      boundStepType: 'manual',
      targetStepType: 'manual',
      pendingTargetNodeId: null,
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'manual step response' });
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: BOUND }),
    );
  });

  // Out-of-band survival after the human ACCEPTS the proposal is a renderer
  // acceptance-path concern whose merge semantics are out of scope here and
  // undecided — title only.
  it.todo('out-of-band children survive proposal acceptance on an autonomous target (acceptance-path merge semantics)');
});
