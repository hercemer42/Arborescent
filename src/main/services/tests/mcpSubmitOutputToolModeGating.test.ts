import { describe, it, expect, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import { createSubmitOutputTool, StepOutputApplier } from '../mcpSubmitOutputTool';
import { OneShotTargetStore } from '../oneShotTargetStore';
import { TreeReadState, TreeReadResult } from '../mcpReadTools';
import { TreeNode } from '../../../shared/types';

// submit_step_output is the pure-collaborate completion channel: its rebuild
// replaces the bound subtree from the submission, so in any execute-bearing
// or action mode a submit would silently overwrite incremental writes. Every
// refusal names the mode and directs the agent to announce_step_done.

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const STEP = 'dddddddd-dddd-dddd-dddd-dddddddddd04';
const CTX = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05';

type StepType = 'manual' | 'checkpoint' | 'autonomous';

function okRead(state: TreeReadState): TreeReadResult {
  return { kind: 'ok', state };
}

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

interface FlagsSetup {
  collaborate: boolean;
  execute: boolean;
  stepType?: StepType;
  withContext?: boolean;
}

function makeStateWithFlags({ collaborate, execute, stepType = 'autonomous', withContext = true }: FlagsSetup): TreeReadState {
  const boundMetadata: TreeNode['metadata'] = withContext ? { appliedContextId: CTX } : {};
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [STEP, CTX]),
      [STEP]: makeNode(STEP, 'Step', [BOUND], { stepType }),
      [BOUND]: makeNode(BOUND, 'Bound', [], boundMetadata),
      [CTX]: makeNode(CTX, 'Context', [], { isContextDeclaration: true, collaborate, execute }),
    },
    rootNodeId: ROOT,
    ancestorRegistry: { [ROOT]: [], [STEP]: [ROOT], [BOUND]: [ROOT, STEP], [CTX]: [ROOT] },
  };
}

function makeToolFor(setup: FlagsSetup, stateOverride?: () => TreeReadState) {
  const registry = new SessionBindingRegistry();
  const applier: StepOutputApplier = { apply: vi.fn(async () => ({ ok: true as const })) };
  const treeReader = {
    readState: vi.fn(async () => okRead(stateOverride ? stateOverride() : makeStateWithFlags(setup))),
  };
  registry.register('sess-1', BOUND);
  const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) };
  return {
    tool: createSubmitOutputTool({ bindingRegistry: registry, treeReader, applier, oneShotTargetStore: new OneShotTargetStore(), proposalSubmitter }),
    applier,
    proposalSubmitter,
  };
}

function submit(tool: ReturnType<typeof makeToolFor>['tool'], content = 'result') {
  return tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content });
}

describe('submit_step_output mode gate — pure collaborate is the only permitted mode', () => {
  it('pure collaborate on an autonomous step applies directly, exactly as today', async () => {
    const { tool, applier } = makeToolFor({ collaborate: true, execute: false });
    const result = await submit(tool);
    expect(result.isError).toBeFalsy();
    expect(applier.apply).toHaveBeenCalledWith('sess-1', BOUND, 'result');
  });

  it('pure collaborate on a manual step still routes to the proposal submitter', async () => {
    const { tool, applier, proposalSubmitter } = makeToolFor({ collaborate: true, execute: false, stepType: 'manual' });
    const result = await submit(tool);
    expect(result.isError).toBeFalsy();
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
  });

  it('pure collaborate applies an empty-content submission (boundary input is the applier\'s concern, not the gate\'s)', async () => {
    const { tool, applier } = makeToolFor({ collaborate: true, execute: false });
    const result = await submit(tool, '');
    expect(result.isError).toBeFalsy();
    expect(applier.apply).toHaveBeenCalled();
  });
});

describe('submit_step_output mode gate — refusals name the mode and direct to announce_step_done', () => {
  it('collaborate & execute is refused: no apply, error names the mode and the alternative', async () => {
    const { tool, applier, proposalSubmitter } = makeToolFor({ collaborate: true, execute: true });
    const result = await submit(tool);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/execute/i);
    expect(result.content[0].text).toMatch(/announce_step_done/);
    expect(applier.apply).not.toHaveBeenCalled();
    expect(proposalSubmitter.submit).not.toHaveBeenCalled();
  });

  it('execute-only is refused: no apply, error names the mode and the alternative', async () => {
    const { tool, applier } = makeToolFor({ collaborate: false, execute: true });
    const result = await submit(tool);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/execute/i);
    expect(result.content[0].text).toMatch(/announce_step_done/);
    expect(applier.apply).not.toHaveBeenCalled();
  });

  it('action mode is refused: no apply, error names the mode and the alternative', async () => {
    const { tool, applier } = makeToolFor({ collaborate: false, execute: false });
    const result = await submit(tool);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/action/i);
    expect(result.content[0].text).toMatch(/announce_step_done/);
    expect(applier.apply).not.toHaveBeenCalled();
  });

  it('a bound step with no applied context (own or inherited) is refused with the no-context error', async () => {
    const { tool, applier } = makeToolFor({ collaborate: true, execute: false, withContext: false });
    const result = await submit(tool);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/no context/i);
    expect(applier.apply).not.toHaveBeenCalled();
  });

  it('refusal on collaborate & execute is repeatable — a retried submit is refused identically, not deduped into a silent no-op', async () => {
    const { tool, applier } = makeToolFor({ collaborate: true, execute: true });
    const first = await submit(tool);
    const second = await submit(tool);
    expect(first.isError).toBe(true);
    expect(second.isError).toBe(true);
    expect(applier.apply).not.toHaveBeenCalled();
  });
});

describe('submit_step_output mode gate — gating is live per call', () => {
  it('flipping the context from both to pure collaborate between calls flips the outcome without rebinding', async () => {
    let flags = { collaborate: true, execute: true };
    const { tool, applier } = makeToolFor(
      { collaborate: true, execute: true },
      () => makeStateWithFlags({ collaborate: flags.collaborate, execute: flags.execute }),
    );

    const refused = await submit(tool);
    expect(refused.isError).toBe(true);

    flags = { collaborate: true, execute: false };
    const allowed = await submit(tool);
    expect(allowed.isError).toBeFalsy();
    expect(applier.apply).toHaveBeenCalledTimes(1);
  });
});

describe('submit_step_output mode gate — one-shot pendingTarget sends bypass the gate', () => {
  it('a pendingTarget send to a node under an execute-only context is not mode-refused — it routes to the proposal panel', async () => {
    const registry = new SessionBindingRegistry();
    const applier: StepOutputApplier = { apply: vi.fn(async () => ({ ok: true as const })) };
    const treeReader = {
      readState: vi.fn(async () => okRead(makeStateWithFlags({ collaborate: false, execute: true, stepType: 'manual' }))),
    };
    const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) };
    const oneShotTargetStore = new OneShotTargetStore();
    oneShotTargetStore.setPendingTarget('sess-1', BOUND);
    const tool = createSubmitOutputTool({ bindingRegistry: registry, treeReader, applier, oneShotTargetStore, proposalSubmitter });

    const result = await tool.submitStepOutput({ sessionId: 'sess-1', targetNodeId: BOUND, content: 'manual send result' });
    expect(result.isError).toBeFalsy();
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
  });
});

describe('submit_step_output mode gate — unbound short-circuit stays ahead of flag resolution', () => {
  it('an unbound session is still a graceful no-op, not a mode refusal', async () => {
    const registry = new SessionBindingRegistry();
    const applier: StepOutputApplier = { apply: vi.fn(async () => ({ ok: true as const })) };
    const treeReader = { readState: vi.fn(async () => okRead(makeStateWithFlags({ collaborate: false, execute: true }))) };
    const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) };
    const tool = createSubmitOutputTool({ bindingRegistry: registry, treeReader, applier, oneShotTargetStore: new OneShotTargetStore(), proposalSubmitter });

    const result = await tool.submitStepOutput({ sessionId: 'sess-unbound', content: 'x' });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text).applied).toBe(false);
    // The unbound path must not even resolve flags — there is no bound node to resolve against.
    expect(treeReader.readState).not.toHaveBeenCalled();
  });
});
