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

// Gate 4 on the manual/collab (proposal) route: when the assistant supplies
// target_node_id on a non-autonomous submit, it must equal the resolved
// boundNodeId (pendingTarget if armed, otherwise bindingRegistry.lookup).
// Mismatch is a hard error so a misrouted submit cannot silently land on
// the workflow-bound node when the user expected it to land on the revise
// target.

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND_A = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const TARGET_B = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
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
      [BOUND_STEP]: makeNode(BOUND_STEP, 'Bound step', [BOUND_A], { stepType: boundStepType }),
      [BOUND_A]: makeNode(BOUND_A, 'A — bound by workflow', [], { appliedContextId: CTX }),
      [TARGET_STEP]: makeNode(TARGET_STEP, 'Target step', [TARGET_B], { stepType: targetStepType }),
      [TARGET_B]: makeNode(TARGET_B, 'B — manual revise target', [], { appliedContextId: CTX }),
      [CTX]: makeNode(CTX, 'Context', [], { isContextDeclaration: true, collaborate: true, execute: false }),
    },
    rootNodeId: ROOT,
    ancestorRegistry: {
      [ROOT]: [],
      [BOUND_STEP]: [ROOT],
      [BOUND_A]: [ROOT, BOUND_STEP],
      [TARGET_STEP]: [ROOT],
      [TARGET_B]: [ROOT, TARGET_STEP],
      [CTX]: [ROOT],
    },
  };
}

function makeTool(opts: {
  boundStepType: StepType;
  targetStepType: StepType;
  pendingTargetNodeId?: string | null;
  markerSeen?: boolean;
}) {
  const registry = new SessionBindingRegistry();
  registry.register('sess-1', BOUND_A);
  const applier: StepOutputApplier = { apply: vi.fn(async () => ({ ok: true as const })) };
  const oneShotTargetStore = new OneShotTargetStore();
  if (opts.pendingTargetNodeId) oneShotTargetStore.setPendingTarget('sess-1', opts.pendingTargetNodeId);
  if (opts.markerSeen !== undefined) oneShotTargetStore.setMarkerSeenThisTurn('sess-1', opts.markerSeen);
  const treeReader = {
    readState: vi.fn(async (_sessionId: string, nodeId: string): Promise<TreeReadResult> => {
      const state = makeState(opts.boundStepType, opts.targetStepType);
      return state.nodes[nodeId] ? { kind: 'ok', state } : { kind: 'node-not-in-open-store' };
    }),
  };
  const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) };
  const tool = createSubmitOutputTool({
    bindingRegistry: registry,
    treeReader,
    applier,
    oneShotTargetStore,
    proposalSubmitter,
  });
  return { tool, applier, proposalSubmitter, oneShotTargetStore };
}

describe('createSubmitOutputTool — manual-route drift guard (gate-4 extension)', () => {
  // Bug repro at the unit level: workflow has bound A, marker arms
  // pendingTarget=B for a manual revise. The submit must land on B, never
  // on A — and a missing/stale pendingTarget must be a loud error, not a
  // silent fallback to A.

  it('routes a manual-collab submit to pendingTarget B even though the session binding still points at A (existing contract — must not regress)', async () => {
    const { tool, proposalSubmitter, applier } = makeTool({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET_B,
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'revise response' });
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: TARGET_B, sessionId: 'sess-1' }),
    );
    expect(proposalSubmitter.submit).not.toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: BOUND_A }),
    );
  });

  it('a manual-route submit that disagrees with the resolved pendingTarget fails loud instead of silently rerouting', async () => {
    const { tool, proposalSubmitter, applier } = makeTool({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET_B,
    });
    const result = await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'x',
      targetNodeId: BOUND_A,
    });
    expect(result.isError).toBe(true);
    expect(proposalSubmitter.submit).not.toHaveBeenCalled();
    expect(applier.apply).not.toHaveBeenCalled();
  });

  it('a manual-route submit with no pendingTarget AND no marker seen this turn still routes to the binding (workflow-step path unchanged)', async () => {
    const { tool, proposalSubmitter } = makeTool({
      boundStepType: 'manual',
      targetStepType: 'manual',
      pendingTargetNodeId: null,
    });
    const result = await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'workflow manual step response',
    });
    expect(result.isError).toBeFalsy();
    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: BOUND_A }),
    );
  });

  it('the drift rejection on the manual route returns a hard MCP error and does NOT invoke proposalSubmitter for the bound node', async () => {
    const { tool, proposalSubmitter } = makeTool({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET_B,
    });
    const result = await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'x',
      targetNodeId: BOUND_A,
    });
    expect(result.isError).toBe(true);
    expect(proposalSubmitter.submit).not.toHaveBeenCalled();
  });

  it('the drift rejection logs a structured gate-miss warning identifying both the token target and the resolved target', async () => {
    const { logger } = await import('../logger');
    const warnMock = vi.mocked(logger.warn);
    warnMock.mockClear();
    const { tool } = makeTool({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET_B,
    });
    await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'x',
      targetNodeId: BOUND_A,
    });
    expect(warnMock).toHaveBeenCalled();
    const msg = String(warnMock.mock.calls[0][0]);
    expect(msg).toContain('gate-miss');
    expect(msg).toContain('gate=4');
    expect(msg).toContain(BOUND_A);
    expect(msg).toContain(TARGET_B);
  });
});

describe('createSubmitOutputTool — pendingTarget persistence across a multi-turn revise discussion', () => {
  // The discussion that follows the initial revise send spans multiple
  // user-prompt turns. Only the first turn carries the ARBORESCENT_TARGET
  // marker; follow-up turns are bare text. pendingTarget must survive those
  // bare turns so the final submit still lands on B, not the workflow's A.

  it('pendingTarget survives a bare follow-up turn (register-target with no target_node_uuid does not clear the pin)', async () => {
    const { tool, oneShotTargetStore, proposalSubmitter } = makeTool({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET_B,
    });
    // Simulate a bare follow-up turn: register-target arrives without a
    // target_node_uuid (handled by the dispatcher as a no-op on the pin).
    oneShotTargetStore.setMarkerSeenThisTurn('sess-1', false);
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET_B);
    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'final response after discussion' });
    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: TARGET_B }),
    );
  });

  it('a bare follow-up turn that arrives between the marker turn and the submit must not silently demote routing back to the workflow binding', async () => {
    const { tool, oneShotTargetStore, proposalSubmitter } = makeTool({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET_B,
    });
    oneShotTargetStore.setMarkerSeenThisTurn('sess-1', false);
    await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'follow-up turn submit',
      targetNodeId: TARGET_B,
    });
    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: TARGET_B }),
    );
    expect(proposalSubmitter.submit).not.toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: BOUND_A }),
    );
  });

});

describe('createSubmitOutputTool — bug repro: revise-after-discussion on B while workflow bound to A', () => {
  // High-level repro that mirrors session 65164a7e: workflow binds A on the
  // session, user invokes Revise after discussion on B, assistant submits.
  // The bug manifested as content landing on A. These tests lock in the
  // post-fix expectations regardless of which gate catches the drift.

  it('the proposal that reaches the renderer carries nodeId=B and never nodeId=A', async () => {
    const { tool, proposalSubmitter } = makeTool({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET_B,
    });
    await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'revise response',
      targetNodeId: TARGET_B,
    });
    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: TARGET_B }),
    );
    expect(proposalSubmitter.submit).not.toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: BOUND_A }),
    );
  });

  it("the workflow-bound node A's authored subtree is unchanged by a manual revise on B (no proposalSubmitter / applier call ever references BOUND_A)", async () => {
    const { tool, proposalSubmitter, applier } = makeTool({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET_B,
    });
    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'revise response' });
    const proposalNodeIds = (proposalSubmitter.submit as unknown as { mock: { calls: Array<[{ nodeId: string }]> } })
      .mock.calls.map((c) => c[0].nodeId);
    const applierNodeIds = (applier.apply as unknown as { mock: { calls: Array<[string, string, string]> } })
      .mock.calls.map((c) => c[1]);
    const allCalls = [...proposalNodeIds, ...applierNodeIds];
    expect(allCalls).not.toContain(BOUND_A);
    expect(allCalls).toContain(TARGET_B);
  });

});
