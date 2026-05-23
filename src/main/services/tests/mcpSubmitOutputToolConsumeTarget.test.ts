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
const CTX = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05';

type StepType = 'manual' | 'checkpoint' | 'autonomous';

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

function makeStateWithTwoNodes(
  boundStepType: StepType | undefined,
  targetStepType: StepType | undefined,
): TreeReadState {
  const boundMeta: TreeNode['metadata'] = { appliedContextId: CTX };
  if (boundStepType !== undefined) boundMeta.stepType = boundStepType;
  const targetMeta: TreeNode['metadata'] = { appliedContextId: CTX };
  if (targetStepType !== undefined) targetMeta.stepType = targetStepType;
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [BOUND, TARGET, CTX]),
      [BOUND]: makeNode(BOUND, 'Bound', [], boundMeta),
      [TARGET]: makeNode(TARGET, 'Target', [], targetMeta),
      [CTX]: makeNode(CTX, 'Context', [], { isContextDeclaration: true, collaborate: true, execute: false }),
    },
    rootNodeId: ROOT,
    ancestorRegistry: { [ROOT]: [], [BOUND]: [ROOT], [TARGET]: [ROOT], [CTX]: [ROOT] },
  };
}

function makeToolFor(opts: {
  boundStepType: StepType | undefined;
  targetStepType: StepType | undefined;
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
    readState: vi.fn(async () => makeStateWithTwoNodes(opts.boundStepType, opts.targetStepType)),
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

describe('createSubmitOutputTool — pendingTarget consume-on-use', () => {
  // The hook script re-emits register-target on every UserPromptSubmit,
  // which clears pendingTarget when the next prompt has no target marker.
  // That is only a between-turns guarantee. Within a single turn, or when
  // two submit_step_output calls fire before the next prompt, pendingTarget
  // must auto-expire after its first use so the second submission falls
  // back to the workflow binding.

  it('clears pendingTarget after a successful direct apply so the next submit falls back to the binding', async () => {
    const { tool, applier, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
    });

    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'first response' });

    expect(applier.apply).toHaveBeenNthCalledWith(1, TARGET, 'first response');
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(null);

    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'second response' });

    expect(applier.apply).toHaveBeenNthCalledWith(2, BOUND, 'second response');
  });

  it('clears pendingTarget after a successful proposal submission so the next submit falls back to the binding', async () => {
    const { tool, applier, proposalSubmitter, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET,
    });

    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'first response' });

    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: TARGET, request: expect.objectContaining({ content: 'first response' }) }),
    );
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(null);

    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'second response' });

    expect(applier.apply).toHaveBeenCalledWith(BOUND, 'second response');
  });

  it('does NOT clear pendingTarget when the applier returns an error — the operation has not actually completed', async () => {
    const { tool, applier, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
      applierResult: { ok: false, error: 'apply failed' },
    });

    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'first response' });

    expect(applier.apply).toHaveBeenCalledWith(TARGET, 'first response');
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET);
  });

  it('does NOT clear pendingTarget when the proposal submitter returns an error — the response has not landed', async () => {
    const { tool, proposalSubmitter, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'manual',
      pendingTargetNodeId: TARGET,
      proposalResult: { ok: false, error: 'proposal rejected' },
    });

    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'first response' });

    expect(proposalSubmitter.submit).toHaveBeenCalledWith(
      expect.objectContaining({ nodeId: TARGET }),
    );
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(TARGET);
  });

  it('clears pendingTarget on the unbound-fallback path too, so a stale target cannot persist when no binding exists', async () => {
    // Terminal has no workflow binding but the manual send set a
    // pendingTarget. After consuming the target the session is fully
    // empty — the next safety-net or rogue submit must see "unbound"
    // rather than be routed to the stale manual node.
    const { tool, applier, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      bindSession: false,
      pendingTargetNodeId: TARGET,
    });

    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'first response' });

    expect(applier.apply).toHaveBeenCalledWith(TARGET, 'first response');
    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(null);

    const second = await tool.submitStepOutput({ sessionId: 'sess-1', content: 'second response' });
    const payload = JSON.parse(second.content[0].text);
    expect(payload.applied).toBe(false);
    expect(payload.reason).toMatch(/unbound/i);
  });

  it('consume is per-session — sess-2 pendingTarget survives a sess-1 submission', async () => {
    const { tool, oneShotTargetStore } = makeToolFor({
      boundStepType: 'autonomous',
      targetStepType: 'autonomous',
      pendingTargetNodeId: TARGET,
    });
    oneShotTargetStore.setPendingTarget('sess-2', TARGET);

    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'x' });

    expect(oneShotTargetStore.pendingTarget('sess-1')).toBe(null);
    expect(oneShotTargetStore.pendingTarget('sess-2')).toBe(TARGET);
  });

  it('safety-net firing against a non-autonomous pendingTarget exits as a no-op and preserves the target', async () => {
    // Safety-net is a best-effort fallback for autonomous one-shots only.
    // Against a non-autonomous target it returns silently without raising a
    // proposal or applying — and crucially must NOT consume pendingTarget,
    // so the next explicit submission still lands on the user's chosen node
    // instead of falling through to the binding registry.
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
});

describe('createSubmitOutputTool — visible signal on routing failure', () => {
  // Today the tool returns {applied:false, reason:"unbound — session has
  // no binding"}; Claude sees the reason but the renderer sees nothing.
  // The renderer-visible surface is undecided so these are placeholders.

  it.todo('emits a renderer-visible signal when neither pendingTarget nor binding exists for the session');
  it.todo('emits a renderer-visible signal when the resolved target node has been deleted from the tree');
  it.todo('explicit (non-safety-net) submissions that cannot be routed surface their reason to the user, not just the Claude session');
});
