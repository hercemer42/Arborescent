import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import { createWriteTools, WriteTools, TreeMutator } from '../mcpWriteTools';
import { TreeReadState, TreeReadResult } from '../mcpReadTools';
import { TreeNode } from '../../../shared/types';

// Pins the mode-gated write-tools surface —
//  - announce_step_done is refused only for pure collaborate; collaborate &
//    execute completes via announce
//  - the autonomous direct-apply route refuses incremental mutations under
//    pure collaborate while user-reviewed proposal routes stay permissive
//  - mark_step_complete takes an optional bound-subtree-scoped node_id

function okRead(state: TreeReadState): TreeReadResult {
  return { kind: 'ok', state };
}

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const SIBLING = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
const STEP = 'dddddddd-dddd-dddd-dddd-dddddddddd04';
const CTX = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05';
const CHILD = 'ffffffff-ffff-ffff-ffff-ffffffffff06';
const MISSING = '99999999-9999-9999-9999-999999999999';

type StepType = 'manual' | 'checkpoint' | 'autonomous';

interface SetupArgs {
  collaborate: boolean;
  execute: boolean;
  stepType?: StepType;
}

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

// Same binding contract as mcpWriteTools.test.ts: session binds to the
// SUBJECT (BOUND) whose parent STEP carries the stepType. CHILD is inside the
// bound subtree; SIBLING is outside it (peer of BOUND under STEP).
function makeState({ collaborate, execute, stepType }: SetupArgs): TreeReadState {
  const stepMetadata: TreeNode['metadata'] = {};
  if (stepType !== undefined) stepMetadata.stepType = stepType;
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [STEP, CTX]),
      [STEP]: makeNode(STEP, 'Step', [BOUND, SIBLING], stepMetadata),
      [BOUND]: makeNode(BOUND, 'Bound', [CHILD], { appliedContextId: CTX }),
      [CHILD]: makeNode(CHILD, 'Item under bound', []),
      [SIBLING]: makeNode(SIBLING, 'Sibling outside bound subtree', []),
      [CTX]: makeNode(CTX, 'Context', [], { isContextDeclaration: true, collaborate, execute }),
    },
    rootNodeId: ROOT,
    ancestorRegistry: {
      [ROOT]: [],
      [STEP]: [ROOT],
      [BOUND]: [ROOT, STEP],
      [CHILD]: [ROOT, STEP, BOUND],
      [SIBLING]: [ROOT, STEP],
      [CTX]: [ROOT],
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
  const oneShotTargetStore = {
    setExplicitSubmitSeenThisTurn: vi.fn(),
  };
  return {
    registry,
    mutator,
    proposalSubmitter,
    oneShotTargetStore,
    deps: { bindingRegistry: registry, treeReader, treeMutator: mutator, proposalSubmitter, oneShotTargetStore },
  };
}

describe('announce_step_done — permitted on collaborate & execute (the gate narrows to pure-collaborate-only)', () => {
  it('both-mode autonomous step: announce succeeds, marks the subject complete, and raises the advance flag', async () => {
    const made = makeDeps({ collaborate: true, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });
    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledWith('sess-1', BOUND, { kind: 'mark-complete', status: 'completed' });
    expect(made.oneShotTargetStore.setExplicitSubmitSeenThisTurn).toHaveBeenCalledWith('sess-1', true);
  });

  it('both-mode checkpoint step: announce succeeds (the Stop handler owns the pause-for-validation routing)', async () => {
    const made = makeDeps({ collaborate: true, execute: true, stepType: 'checkpoint' });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });
    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledWith('sess-1', BOUND, { kind: 'mark-complete', status: 'completed' });
  });

  it('pure-collaborate step: announce is still refused and directs to submit_step_output', async () => {
    const made = makeDeps({ collaborate: true, execute: false, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/submit_step_output/);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('both-mode manual step: announce is still refused as UI-only', async () => {
    const made = makeDeps({ collaborate: true, execute: true, stepType: 'manual' });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.announceStepDone({ sessionId: 'sess-1' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/manual|user interface/i);
  });
});

describe('autonomous pure-collaborate — incremental mutations are refused toward the single submit channel', () => {
  let made: ReturnType<typeof makeDeps>;
  let tools: WriteTools;

  beforeEach(() => {
    made = makeDeps({ collaborate: true, execute: false, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    tools = createWriteTools(made.deps);
  });

  it('add_child_node is refused with a redirect to submit_step_output and nothing applies', async () => {
    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: BOUND, content: 'mid-run note' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/submit_step_output/);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
    expect(made.proposalSubmitter.submit).not.toHaveBeenCalled();
  });

  it('append_to_node is refused with a redirect to submit_step_output', async () => {
    const result = await tools.appendToNode({ sessionId: 'sess-1', content: 'appended' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/submit_step_output/);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('mark_step_complete is refused too — a leaked transient status is worse than a clean refusal', async () => {
    const result = await tools.markStepComplete({ sessionId: 'sess-1', status: 'completed' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/submit_step_output/);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });
});

describe('manual and checkpoint pure-collaborate — proposal routes stay permissive', () => {
  it.each(['manual', 'checkpoint'] as const)('%s step: add_child_node produces a proposal, not a refusal', async (stepType) => {
    const made = makeDeps({ collaborate: true, execute: false, stepType });
    made.registry.register('sess-1', BOUND);
    const tools = createWriteTools(made.deps);

    const result = await tools.addChildNode({ sessionId: 'sess-1', parent_id: BOUND, content: 'proposed child' });
    expect(result.isError).toBeFalsy();
    expect(made.proposalSubmitter.submit).toHaveBeenCalledTimes(1);
    expect(JSON.parse(result.content[0].text)).toMatchObject({ applied: false, proposed: true });
  });
});

describe('mark_step_complete node_id — per-item check-offs scoped to the bound subtree', () => {
  let made: ReturnType<typeof makeDeps>;
  let tools: WriteTools;

  beforeEach(() => {
    made = makeDeps({ collaborate: true, execute: true, stepType: 'autonomous' });
    made.registry.register('sess-1', BOUND);
    tools = createWriteTools(made.deps);
  });

  it('node_id resolving to a descendant of the bound node ticks that item', async () => {
    const result = await tools.markStepComplete({ sessionId: 'sess-1', status: 'completed', node_id: CHILD });
    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledWith('sess-1', CHILD, { kind: 'mark-complete', status: 'completed' });
  });

  it('node_id equal to the bound node itself is accepted (degenerate in-subtree case)', async () => {
    const result = await tools.markStepComplete({ sessionId: 'sess-1', status: 'completed', node_id: BOUND });
    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledWith('sess-1', BOUND, { kind: 'mark-complete', status: 'completed' });
  });

  it('omitted node_id targets the bound node exactly as today', async () => {
    const result = await tools.markStepComplete({ sessionId: 'sess-1', status: 'completed' });
    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledWith('sess-1', BOUND, { kind: 'mark-complete', status: 'completed' });
  });

  it('node_id outside the bound subtree is refused naming the bound root, and no status changes', async () => {
    const result = await tools.markStepComplete({ sessionId: 'sess-1', status: 'completed', node_id: SIBLING });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(BOUND);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('node_id that does not exist in the tree is refused, and no status changes', async () => {
    const result = await tools.markStepComplete({ sessionId: 'sess-1', status: 'completed', node_id: MISSING });
    expect(result.isError).toBe(true);
    expect(made.mutator.mutate).not.toHaveBeenCalled();
  });

  it('abandoned status rides node_id targeting the same way', async () => {
    const result = await tools.markStepComplete({ sessionId: 'sess-1', status: 'abandoned', node_id: CHILD });
    expect(result.isError).toBeFalsy();
    expect(made.mutator.mutate).toHaveBeenCalledWith('sess-1', CHILD, { kind: 'mark-complete', status: 'abandoned' });
  });

  it('node_id check-off on a manual step routes to the proposal queue, not direct apply', async () => {
    const manualMade = makeDeps({ collaborate: true, execute: true, stepType: 'manual' });
    manualMade.registry.register('sess-1', BOUND);
    const manualTools = createWriteTools(manualMade.deps);

    const result = await manualTools.markStepComplete({ sessionId: 'sess-1', status: 'completed', node_id: CHILD });
    expect(result.isError).toBeFalsy();
    expect(manualMade.mutator.mutate).not.toHaveBeenCalled();
    expect(manualMade.proposalSubmitter.submit).toHaveBeenCalledWith({
      sessionId: 'sess-1',
      nodeId: CHILD,
      request: { kind: 'mark-complete', status: 'completed' },
    });
  });
});

describe('gating is live per call — a step-type edit between calls changes the route', () => {
  it('flipping stepType from manual to autonomous switches the same call from proposal to direct apply', async () => {
    const registry = new SessionBindingRegistry();
    let stepType: StepType = 'manual';
    const mutator: TreeMutator = { mutate: vi.fn(async () => ({ ok: true as const })) };
    const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'p' })) };
    const treeReader = {
      readState: vi.fn(async (): Promise<TreeReadResult> =>
        okRead(makeState({ collaborate: true, execute: true, stepType }))),
    };
    const oneShotTargetStore = { setExplicitSubmitSeenThisTurn: vi.fn() };
    const tools = createWriteTools({ bindingRegistry: registry, treeReader, treeMutator: mutator, proposalSubmitter, oneShotTargetStore });
    registry.register('sess-1', BOUND);

    const proposed = await tools.addChildNode({ sessionId: 'sess-1', parent_id: BOUND, content: 'child' });
    expect(proposed.isError).toBeFalsy();
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
    expect(mutator.mutate).not.toHaveBeenCalled();

    stepType = 'autonomous';
    const applied = await tools.addChildNode({ sessionId: 'sess-1', parent_id: BOUND, content: 'child' });
    expect(applied.isError).toBeFalsy();
    expect(mutator.mutate).toHaveBeenCalledTimes(1);
    expect(proposalSubmitter.submit).toHaveBeenCalledTimes(1);
  });
});
