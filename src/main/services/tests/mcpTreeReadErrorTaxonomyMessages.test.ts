import { describe, it, expect, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import { logger } from '../logger';
import { createSubmitOutputTool, StepOutputApplier } from '../mcpSubmitOutputTool';
import { createReadTools, TreeReader, TreeReadState, TreeReadResult, ToolResult } from '../mcpReadTools';
import { createWriteTools, TreeMutator } from '../mcpWriteTools';
import { OneShotTargetStore } from '../oneShotTargetStore';
import { TreeNode } from '../../../shared/types';

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const STEP = 'dddddddd-dddd-dddd-dddd-dddddddddd04';
const SESSION = 'sess-1';

const OLD_CATCH_ALL = 'Tree state is unavailable. The renderer may not be ready or no file is open.';

// Discriminated error taxonomy: every tree-read consumer reports the real
// cause instead of the old catch-all. The three failure variants are
// not-ready (transient, retry), no-session-store (file not open or session
// not registered yet), and node-not-in-open-store (deleted or wrong file —
// deliberately non-decisive). Messages carry boundNodeId and sessionId.

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

function makeOkState(): TreeReadState {
  return {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [STEP]),
      [STEP]: makeNode(STEP, 'Step', [BOUND], { stepType: 'autonomous' }),
      [BOUND]: makeNode(BOUND, 'Bound', []),
    },
    rootNodeId: ROOT,
    ancestorRegistry: { [ROOT]: [], [STEP]: [ROOT], [BOUND]: [ROOT, STEP] },
  };
}

function readerOf(result: TreeReadResult): TreeReader {
  return { readState: vi.fn(async () => result) };
}

function makeSubmitTool(readResult: TreeReadResult) {
  const registry = new SessionBindingRegistry();
  registry.register(SESSION, BOUND);
  const applier: StepOutputApplier = { apply: vi.fn(async () => ({ ok: true as const })) };
  const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'prop-1' })) };
  const tool = createSubmitOutputTool({
    bindingRegistry: registry,
    treeReader: readerOf(readResult),
    applier,
    oneShotTargetStore: new OneShotTargetStore(),
    proposalSubmitter,
  });
  return { tool, applier };
}

function makeReadTools(readResult: TreeReadResult) {
  const registry = new SessionBindingRegistry();
  registry.register(SESSION, BOUND);
  return createReadTools({ bindingRegistry: registry, treeReader: readerOf(readResult) });
}

function makeWriteTools(readResult: TreeReadResult) {
  const registry = new SessionBindingRegistry();
  registry.register(SESSION, BOUND);
  const treeMutator: TreeMutator = { mutate: vi.fn(async () => ({ ok: true as const })) };
  const proposalSubmitter = { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'prop-1' })) };
  return createWriteTools({
    bindingRegistry: registry,
    treeReader: readerOf(readResult),
    treeMutator,
    proposalSubmitter,
    oneShotTargetStore: new OneShotTargetStore(),
  });
}

function textOf(result: ToolResult): string {
  return result.content[0].text;
}

async function submitWith(readResult: TreeReadResult): Promise<ToolResult> {
  const { tool } = makeSubmitTool(readResult);
  return tool.submitStepOutput({ sessionId: SESSION, targetNodeId: BOUND, content: 'output' });
}

describe('submit_step_output — per-variant error messages', () => {
  it('not-ready yields an error naming the transient renderer condition and recommending retry, with both ids', async () => {
    const result = await submitWith({ kind: 'not-ready' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/renderer/i);
    expect(textOf(result)).toMatch(/retry/i);
    expect(textOf(result)).toContain(BOUND);
    expect(textOf(result)).toContain(SESSION);
  });

  it('no-session-store yields an error saying the file may not be open or the session not registered yet, with both ids', async () => {
    const result = await submitWith({ kind: 'no-session-store' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/open/i);
    expect(textOf(result)).toMatch(/registered/i);
    expect(textOf(result)).toContain(BOUND);
    expect(textOf(result)).toContain(SESSION);
    expect(textOf(result)).not.toMatch(/retry/i);
  });

  it('node-not-in-open-store yields an error naming both the deleted and wrong-file possibilities, with both ids and no retry advice', async () => {
    const result = await submitWith({ kind: 'node-not-in-open-store' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toMatch(/deleted/i);
    expect(textOf(result)).toMatch(/file/i);
    expect(textOf(result)).toContain(BOUND);
    expect(textOf(result)).toContain(SESSION);
    expect(textOf(result)).not.toMatch(/retry/i);
  });

  it('the three variant messages are mutually distinguishable and none is the old catch-all', async () => {
    const notReady = textOf(await submitWith({ kind: 'not-ready' }));
    const noStore = textOf(await submitWith({ kind: 'no-session-store' }));
    const nodeGone = textOf(await submitWith({ kind: 'node-not-in-open-store' }));

    expect(notReady).not.toBe(noStore);
    expect(notReady).not.toBe(nodeGone);
    expect(noStore).not.toBe(nodeGone);
    for (const message of [notReady, noStore, nodeGone]) {
      expect(message).not.toBe(OLD_CATCH_ALL);
    }
  });

  it('each failure variant emits one main-process log line carrying the discriminated cause', async () => {
    for (const kind of ['not-ready', 'no-session-store', 'node-not-in-open-store'] as const) {
      vi.mocked(logger.warn).mockClear();

      await submitWith({ kind });

      expect(logger.warn).toHaveBeenCalledTimes(1);
      expect(vi.mocked(logger.warn).mock.calls[0][0]).toContain(`kind=${kind}`);
    }
  });

  it('the success path is unchanged — an ok result applies the content on the autonomous route', async () => {
    const { tool, applier } = makeSubmitTool({ kind: 'ok', state: makeOkState() });

    const result = await tool.submitStepOutput({ sessionId: SESSION, targetNodeId: BOUND, content: 'output' });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual({ applied: true });
    expect(applier.apply).toHaveBeenCalledWith(SESSION, BOUND, 'output');
  });
});

describe('read tools — shared variant handling via withBoundNode', () => {
  it('getNode reports the three variants with the same distinguishable messages as submit_step_output', async () => {
    const notReady = await makeReadTools({ kind: 'not-ready' }).getNode({ sessionId: SESSION });
    const noStore = await makeReadTools({ kind: 'no-session-store' }).getNode({ sessionId: SESSION });
    const nodeGone = await makeReadTools({ kind: 'node-not-in-open-store' }).getNode({ sessionId: SESSION });

    for (const result of [notReady, noStore, nodeGone]) {
      expect(result.isError).toBe(true);
      expect(textOf(result)).not.toBe(OLD_CATCH_ALL);
      expect(textOf(result)).toContain(BOUND);
      expect(textOf(result)).toContain(SESSION);
    }
    const submitNotReady = await submitWith({ kind: 'not-ready' });
    expect(textOf(notReady)).toBe(textOf(submitNotReady));
    expect(new Set([textOf(notReady), textOf(noStore), textOf(nodeGone)]).size).toBe(3);
  });

  it('getNode succeeds unchanged on an ok result', async () => {
    const result = await makeReadTools({ kind: 'ok', state: makeOkState() }).getNode({ sessionId: SESSION });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result)).id).toBe(BOUND);
  });
});

describe('write tools — shared variant handling via resolveBoundState', () => {
  it('appendToNode reports the three variants with the same distinguishable messages as submit_step_output', async () => {
    const notReady = await makeWriteTools({ kind: 'not-ready' }).appendToNode({ sessionId: SESSION, content: 'x' });
    const noStore = await makeWriteTools({ kind: 'no-session-store' }).appendToNode({ sessionId: SESSION, content: 'x' });
    const nodeGone = await makeWriteTools({ kind: 'node-not-in-open-store' }).appendToNode({ sessionId: SESSION, content: 'x' });

    for (const result of [notReady, noStore, nodeGone]) {
      expect(result.isError).toBe(true);
      expect(textOf(result)).not.toBe(OLD_CATCH_ALL);
      expect(textOf(result)).toContain(BOUND);
      expect(textOf(result)).toContain(SESSION);
    }
    const submitNodeGone = await submitWith({ kind: 'node-not-in-open-store' });
    expect(textOf(nodeGone)).toBe(textOf(submitNodeGone));
    expect(new Set([textOf(notReady), textOf(noStore), textOf(nodeGone)]).size).toBe(3);
  });
});

describe('unbound sessions — pre-read branch untouched by the taxonomy', () => {
  it('a session with no binding still reports the unbound reason without consulting readState', async () => {
    const registry = new SessionBindingRegistry();
    const reader = readerOf({ kind: 'ok', state: makeOkState() });
    const tool = createSubmitOutputTool({
      bindingRegistry: registry,
      treeReader: reader,
      applier: { apply: vi.fn(async () => ({ ok: true as const })) },
      oneShotTargetStore: new OneShotTargetStore(),
      proposalSubmitter: { submit: vi.fn(async () => ({ ok: true as const, proposalId: 'prop-1' })) },
    });

    const result = await tool.submitStepOutput({ sessionId: 'sess-unbound', content: 'output' });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result)).reason).toContain('unbound');
    expect(reader.readState).not.toHaveBeenCalled();
  });
});
