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
import { TreeReadState, TreeReadResult } from '../mcpReadTools';
import { TreeNode } from '../../../shared/types';

// Gate 4: target-keyed binding token.
//
// boundNodeId is resolved at submit time from oneShotTargetStore.pendingTarget
// or bindingRegistry.lookup, which may have drifted from the node the prompt
// was originally rendered for (workflow advance, new send, one-shot target
// set, decomposition recurse). The submission carries a target-keyed token
// (targetNodeId, a plain UUID) and is rejected with an MCP error when the
// resolved boundNodeId disagrees.
//
// Scope:
//   - Autonomous route: token is REQUIRED; missing or mismatched token rejects.
//   - Proposal/manual-collab route: token is OPTIONAL (backward compat for
//     in-flight conversations) but VALIDATED when present; a mismatched token
//     rejects with the same drift error rather than silently writing to the
//     bound node.

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const OTHER_TARGET = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
const STEP = 'dddddddd-dddd-dddd-dddd-dddddddddd04';
const CTX = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05';

type StepType = 'manual' | 'checkpoint' | 'autonomous';

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

// The session binds to the SUBJECT (BOUND); its parent STEP carries the
// stepType. The subject never carries stepType itself.
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
  const treeReader = {
    readState: vi.fn(async (_sessionId: string, nodeId: string): Promise<TreeReadResult> => {
      const state = makeState(stepType);
      return state.nodes[nodeId] ? { kind: 'ok', state } : { kind: 'node-not-in-open-store' };
    }),
  };
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

describe('createSubmitOutputTool — gate 4 drift rejection on autonomous route', () => {
  let tool: SubmitOutputTool;
  let applier: StepOutputApplier;

  beforeEach(() => {
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    tool = createSubmitOutputTool(made.deps);
    applier = made.applier;
  });

  it('rejects with an MCP error when the prompt token nodeId differs from the current resolved boundNodeId', async () => {
    const result = await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'late content',
      targetNodeId: OTHER_TARGET,
    });
    expect(result.isError).toBe(true);
    expect(applier.apply).not.toHaveBeenCalled();
  });

  it('rejects when targetNodeId is missing on an autonomous-route submission', async () => {
    const result = await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'autonomous content with no token',
    });
    expect(result.isError).toBe(true);
    expect(applier.apply).not.toHaveBeenCalled();
  });

  it('the rejection error message identifies the gate-4 drift so the MCP caller can diagnose', async () => {
    const result = await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'x',
      targetNodeId: OTHER_TARGET,
    });
    expect(result.isError).toBe(true);
    const errorText = result.content[0].text.toLowerCase();
    expect(errorText).toMatch(/target|drift|gate/);
  });

  it('logs a structured warning on token mismatch identifying both the token nodeId and the resolved boundNodeId', async () => {
    const { logger } = await import('../logger');
    const warnMock = vi.mocked(logger.warn);
    warnMock.mockClear();
    await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'x',
      targetNodeId: OTHER_TARGET,
    });
    expect(warnMock).toHaveBeenCalled();
    const msg = String(warnMock.mock.calls[0][0]);
    expect(msg).toContain('gate-miss');
    expect(msg).toContain('gate=4');
    expect(msg).toContain(OTHER_TARGET);
    expect(msg).toContain(BOUND);
  });

  it('drift rejection returns a hard MCP error rather than rerouting via proposalSubmitter — Claude\'s late content for the old target is lost (user beware)', async () => {
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    const localTool = createSubmitOutputTool(made.deps);
    const result = await localTool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'x',
      targetNodeId: OTHER_TARGET,
    });
    expect(result.isError).toBe(true);
    expect(made.proposalSubmitter.submit).not.toHaveBeenCalled();
  });
});

describe('createSubmitOutputTool — gate 4 happy path (same-target)', () => {
  let tool: SubmitOutputTool;
  let applier: StepOutputApplier;

  beforeEach(() => {
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    tool = createSubmitOutputTool(made.deps);
    applier = made.applier;
  });

  it('accepts the submission when the prompt token nodeId equals the resolved boundNodeId', async () => {
    const result = await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'matched content',
      targetNodeId: BOUND,
    });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text)).toEqual({ applied: true });
    expect(applier.apply).toHaveBeenCalledWith('sess-1', BOUND, 'matched content');
  });

  it('N consecutive same-target submissions all succeed (token is plain UUID, not a monotonic counter)', async () => {
    for (let i = 0; i < 4; i++) {
      const result = await tool.submitStepOutput({
        sessionId: 'sess-1',
        content: `payload ${i}`,
        targetNodeId: BOUND,
      });
      expect(result.isError).toBeFalsy();
    }
    expect(applier.apply).toHaveBeenCalledTimes(4);
  });
});

describe('createSubmitOutputTool — gate 4 on manual-collab (non-autonomous) route', () => {
  it('manual-collab submission with no targetNodeId routes to proposalSubmitter (token is optional on the manual route for backward compat)', async () => {
    const made = makeDeps('manual');
    made.registry.register('sess-1', BOUND);
    const tool = createSubmitOutputTool(made.deps);

    const result = await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'manual response',
    });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text)).toMatchObject({ applied: false, proposed: true });
    expect(made.proposalSubmitter.submit).toHaveBeenCalledTimes(1);
    expect(made.applier.apply).not.toHaveBeenCalled();
  });

  it('manual-collab submission with a stale targetNodeId is rejected as drift — gate 4 now applies on the proposal route', async () => {
    const made = makeDeps('manual');
    made.registry.register('sess-1', BOUND);
    const tool = createSubmitOutputTool(made.deps);

    const result = await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'manual response',
      targetNodeId: OTHER_TARGET,
    });
    expect(result.isError).toBe(true);
    const errorText = result.content[0].text.toLowerCase();
    expect(errorText).toMatch(/drift|target/);
    expect(made.proposalSubmitter.submit).not.toHaveBeenCalled();
    expect(made.applier.apply).not.toHaveBeenCalled();
  });

  it('manual-collab submission with a matching targetNodeId routes to proposalSubmitter normally', async () => {
    const made = makeDeps('manual');
    made.registry.register('sess-1', BOUND);
    const tool = createSubmitOutputTool(made.deps);

    const result = await tool.submitStepOutput({
      sessionId: 'sess-1',
      content: 'manual response',
      targetNodeId: BOUND,
    });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text)).toMatchObject({ applied: false, proposed: true });
    expect(made.proposalSubmitter.submit).toHaveBeenCalledTimes(1);
  });

  it('multiple manual-collab resubmissions to the same pendingTarget all succeed (discuss-then-refresh loop preserved per commit f7e8b59)', async () => {
    const made = makeDeps('manual');
    made.registry.register('sess-1', BOUND);
    made.oneShotTargetStore.setPendingTarget('sess-1', BOUND);
    const tool = createSubmitOutputTool(made.deps);

    for (let i = 0; i < 3; i++) {
      const result = await tool.submitStepOutput({
        sessionId: 'sess-1',
        content: `iteration ${i}`,
        targetNodeId: BOUND,
      });
      expect(result.isError).toBeFalsy();
    }
    expect(made.proposalSubmitter.submit).toHaveBeenCalledTimes(3);
  });
});
