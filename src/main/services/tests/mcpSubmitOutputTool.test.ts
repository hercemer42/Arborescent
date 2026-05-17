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
import { SubmitMarker } from '../submitMarker';
import { TreeReadState } from '../mcpReadTools';
import { TreeNode } from '../../../shared/types';

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const CTX = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05';

type StepType = 'manual' | 'checkpoint' | 'autonomous';

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

function makeState(stepType: StepType | undefined): TreeReadState {
  const boundMetadata: TreeNode['metadata'] = { appliedContextId: CTX };
  if (stepType !== undefined) boundMetadata.stepType = stepType;
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [BOUND, CTX]),
      [BOUND]: makeNode(BOUND, 'Bound', [], boundMetadata),
      [CTX]: makeNode(CTX, 'Context', [], { isContextDeclaration: true, collaborate: true, execute: false }),
    },
    rootNodeId: ROOT,
    ancestorRegistry: { [ROOT]: [], [BOUND]: [ROOT], [CTX]: [ROOT] },
  };
}

function makeDeps(stepType: StepType | undefined) {
  const registry = new SessionBindingRegistry();
  const applier: StepOutputApplier = {
    apply: vi.fn(async () => ({ ok: true as const })),
  };
  const treeReader = { readState: vi.fn(async () => makeState(stepType)) };
  const marker = new SubmitMarker();
  return {
    registry,
    applier,
    treeReader,
    marker,
    deps: { bindingRegistry: registry, treeReader, applier, marker },
  };
}

describe('createSubmitOutputTool — automatic step writes directly to the node', () => {
  let tool: SubmitOutputTool;
  let applier: StepOutputApplier;
  let marker: SubmitMarker;

  beforeEach(() => {
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    tool = createSubmitOutputTool(made.deps);
    applier = made.applier;
    marker = made.marker;
  });

  it('applies the submitted content to the bound node and reports applied=true', async () => {
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', content: 'AI response' });
    expect(result.isError).toBeFalsy();
    expect(JSON.parse(result.content[0].text)).toEqual({ applied: true });
    expect(applier.apply).toHaveBeenCalledWith(BOUND, 'AI response');
  });

  it('sets the submit marker on success so the auto-submit safety net can dedupe', async () => {
    expect(marker.hasSubmitted('sess-1')).toBe(false);
    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'response' });
    expect(marker.hasSubmitted('sess-1')).toBe(true);
  });

  it('does NOT set the submit marker when the applier returns an error', async () => {
    (applier.apply as ReturnType<typeof vi.fn>).mockImplementation(async () => ({ ok: false, error: 'apply failed' }));
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', content: 'response' });
    expect(result.isError).toBe(true);
    expect(marker.hasSubmitted('sess-1')).toBe(false);
  });

  it('an empty content string still triggers an apply — empty is a valid AI response', async () => {
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', content: '' });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).toHaveBeenCalledWith(BOUND, '');
  });
});

describe('createSubmitOutputTool — second call within the same turn is a no-op (auto-submit dedupe)', () => {
  let tool: SubmitOutputTool;
  let applier: StepOutputApplier;

  beforeEach(() => {
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    tool = createSubmitOutputTool(made.deps);
    applier = made.applier;
  });

  it('a second submit_step_output for the same session does not call the applier again', async () => {
    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'first' });
    (applier.apply as ReturnType<typeof vi.fn>).mockClear();
    const second = await tool.submitStepOutput({ sessionId: 'sess-1', content: 'second' });
    expect(applier.apply).not.toHaveBeenCalled();
    expect(second.isError).toBeFalsy();
    const payload = JSON.parse(second.content[0].text);
    expect(payload.applied).toBe(false);
    expect(payload.reason).toMatch(/already submitted|deduped/i);
  });
});

describe('createSubmitOutputTool — after the marker is reset (new turn), the next submit applies', () => {
  it('reset between calls allows the second submit to apply', async () => {
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', BOUND);
    const tool = createSubmitOutputTool(made.deps);

    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'turn-1' });
    made.marker.reset('sess-1');
    (made.applier.apply as ReturnType<typeof vi.fn>).mockClear();

    const second = await tool.submitStepOutput({ sessionId: 'sess-1', content: 'turn-2' });
    expect(second.isError).toBeFalsy();
    expect(made.applier.apply).toHaveBeenCalledWith(BOUND, 'turn-2');
  });
});

describe('createSubmitOutputTool — step-type gate', () => {
  function withStepType(stepType: StepType | undefined) {
    const made = makeDeps(stepType);
    made.registry.register('sess-1', BOUND);
    return { tool: createSubmitOutputTool(made.deps), applier: made.applier, marker: made.marker };
  }

  it('manual step rejects with a descriptive error (PR7 will route to feedback)', async () => {
    const { tool, applier } = withStepType('manual');
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', content: 'x' });
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not automatic|reviewed by the user/i);
    expect(applier.apply).not.toHaveBeenCalled();
  });

  it('checkpoint step rejects with a descriptive error', async () => {
    const { tool, applier } = withStepType('checkpoint');
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', content: 'x' });
    expect(result.isError).toBe(true);
    expect(applier.apply).not.toHaveBeenCalled();
  });

  it('a node with no stepType set is treated as non-automatic and rejected', async () => {
    const { tool, applier } = withStepType(undefined);
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', content: 'x' });
    expect(result.isError).toBe(true);
    expect(applier.apply).not.toHaveBeenCalled();
  });

  it('a rejected non-automatic submit does NOT set the marker (next turn can retry)', async () => {
    const { tool, marker } = withStepType('manual');
    await tool.submitStepOutput({ sessionId: 'sess-1', content: 'x' });
    expect(marker.hasSubmitted('sess-1')).toBe(false);
  });
});

describe('createSubmitOutputTool — unbound session is a graceful no-op (not an error)', () => {
  it('submit_step_output for an unknown session returns ok with applied=false, reason=unbound', async () => {
    const made = makeDeps('autonomous');
    // do NOT register sess-1
    const tool = createSubmitOutputTool(made.deps);

    const result = await tool.submitStepOutput({ sessionId: 'sess-1', content: 'orphan response' });

    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(result.content[0].text);
    expect(payload.applied).toBe(false);
    expect(payload.reason).toMatch(/unbound|no binding|not bound/i);
    expect(made.applier.apply).not.toHaveBeenCalled();
  });

  it('an unbound graceful no-op does NOT touch the submit marker', async () => {
    const made = makeDeps('autonomous');
    const tool = createSubmitOutputTool(made.deps);
    await tool.submitStepOutput({ sessionId: 'sess-unknown', content: 'x' });
    expect(made.marker.hasSubmitted('sess-unknown')).toBe(false);
  });

  it('does NOT call the tree reader for an unbound session (no wasted IPC round trip)', async () => {
    const made = makeDeps('autonomous');
    const tool = createSubmitOutputTool(made.deps);
    await tool.submitStepOutput({ sessionId: 'sess-unknown', content: 'x' });
    expect(made.treeReader.readState).not.toHaveBeenCalled();
  });
});

describe('createSubmitOutputTool — error propagation', () => {
  it('an orphan binding (node missing from tree) returns a descriptive error', async () => {
    const made = makeDeps('autonomous');
    made.registry.register('sess-1', 'unknown-node');
    const tool = createSubmitOutputTool(made.deps);

    const result = await tool.submitStepOutput({ sessionId: 'sess-1', content: 'x' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toMatch(/not found|orphan/i);
    expect(made.applier.apply).not.toHaveBeenCalled();
  });

  it('tree state unavailable returns a descriptive error', async () => {
    const registry = new SessionBindingRegistry();
    const applier: StepOutputApplier = { apply: vi.fn(async () => ({ ok: true as const })) };
    const marker = new SubmitMarker();
    const tool = createSubmitOutputTool({
      bindingRegistry: registry,
      treeReader: { readState: async () => null },
      applier,
      marker,
    });
    registry.register('sess-1', BOUND);

    const result = await tool.submitStepOutput({ sessionId: 'sess-1', content: 'x' });

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

    const result = await tool.submitStepOutput({ sessionId: 'sess-1', content: 'x' });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('collaborating node mismatch');
  });
});

describe('createSubmitOutputTool — mode-agnostic on automatic steps', () => {
  function makeStateWithFlags(collaborate: boolean, execute: boolean): TreeReadState {
    return {
      nodes: {
        [ROOT]: makeNode(ROOT, 'Root', [BOUND, CTX]),
        [BOUND]: makeNode(BOUND, 'Bound', [], { appliedContextId: CTX, stepType: 'autonomous' }),
        [CTX]: makeNode(CTX, 'Context', [], { isContextDeclaration: true, collaborate, execute }),
      },
      rootNodeId: ROOT,
      ancestorRegistry: { [ROOT]: [], [BOUND]: [ROOT], [CTX]: [ROOT] },
    };
  }

  function makeToolFor(collaborate: boolean, execute: boolean) {
    const registry = new SessionBindingRegistry();
    const applier: StepOutputApplier = { apply: vi.fn(async () => ({ ok: true as const })) };
    const marker = new SubmitMarker();
    const treeReader = { readState: async () => makeStateWithFlags(collaborate, execute) };
    registry.register('sess-1', BOUND);
    return {
      tool: createSubmitOutputTool({ bindingRegistry: registry, treeReader, applier, marker }),
      applier,
    };
  }

  it('collaborate-only mode allows submit_step_output on an automatic step', async () => {
    const { tool, applier } = makeToolFor(true, false);
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', content: 'x' });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).toHaveBeenCalled();
  });

  it('execute-only mode allows submit_step_output on an automatic step (this is the output channel, not a tree-mutation)', async () => {
    const { tool, applier } = makeToolFor(false, true);
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', content: 'x' });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).toHaveBeenCalled();
  });

  it('collaborate+execute mode allows submit_step_output on an automatic step', async () => {
    const { tool, applier } = makeToolFor(true, true);
    const result = await tool.submitStepOutput({ sessionId: 'sess-1', content: 'x' });
    expect(result.isError).toBeFalsy();
    expect(applier.apply).toHaveBeenCalled();
  });
});
