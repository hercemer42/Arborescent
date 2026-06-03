import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { SessionBindingRegistry } from '../sessionBindingRegistry';
import { logger } from '../logger';
import { createSubmitOutputTool, StepOutputApplier } from '../mcpSubmitOutputTool';
import { createReadTools, TreeReader, TreeReadResult, TreeReadState, ToolResult } from '../mcpReadTools';
import { createWriteTools, TreeMutator } from '../mcpWriteTools';
import { OneShotTargetStore } from '../oneShotTargetStore';
import { MODE_POLICY } from '../../../shared/utils/permissionGate';
import { McpErrorCode } from '../../../shared/utils/mcpErrorCodes';
import { TreeNode } from '../../../shared/types';

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const OUTSIDE = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
const STEP = 'dddddddd-dddd-dddd-dddd-dddddddddd04';
const CTX = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee05';
const SESSION = 'sess-1';

// Every write-path failure must deliver a stable machine-readable code as a
// structured field on the tool result, while content[0].text prose stays
// verbatim for the hookScripts consumer, and the corresponding gate=/reason=
// log line must carry the same code string the client receives.

function makeNode(id: string, content: string, children: string[] = [], metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children, metadata };
}

interface StateOptions {
  contextFlags?: { collaborate: boolean; execute: boolean } | null;
  stepType?: 'autonomous' | 'manual' | 'checkpoint' | null;
}

// contextFlags=null models a context-less bound node; stepType=null models a
// non-autonomous (manual / free-terminal) parent step.
function makeState(options: StateOptions = {}): TreeReadState {
  const { contextFlags = { collaborate: true, execute: false }, stepType = 'autonomous' } = options;
  const boundMetadata: TreeNode['metadata'] = contextFlags ? { appliedContextId: CTX } : {};
  const stepMetadata: TreeNode['metadata'] = stepType ? { stepType } : {};
  const nodes: Record<string, TreeNode> = {
    [ROOT]: makeNode(ROOT, 'Root', [STEP, CTX, OUTSIDE]),
    [STEP]: makeNode(STEP, 'Step', [BOUND], stepMetadata),
    [BOUND]: makeNode(BOUND, 'Bound', [], boundMetadata),
    [OUTSIDE]: makeNode(OUTSIDE, 'Outside'),
  };
  if (contextFlags) {
    nodes[CTX] = makeNode(CTX, 'Context', [], {
      isContextDeclaration: true,
      collaborate: contextFlags.collaborate,
      execute: contextFlags.execute,
    });
  }
  return {
    nodes,
    rootNodeId: ROOT,
    ancestorRegistry: {
      [ROOT]: [],
      [STEP]: [ROOT],
      [BOUND]: [ROOT, STEP],
      [OUTSIDE]: [ROOT],
      ...(contextFlags ? { [CTX]: [ROOT] } : {}),
    },
  };
}

function readerOf(result: TreeReadResult): TreeReader {
  return { readState: vi.fn(async () => result) };
}

interface SubmitHarnessOptions {
  bound?: boolean;
  applierResult?: { ok: true } | { ok: false; error: string; code?: McpErrorCode };
  proposalResult?: { ok: true; proposalId: string } | { ok: false; error: string };
}

function makeSubmitTool(readResult: TreeReadResult, options: SubmitHarnessOptions = {}) {
  const { bound = true, applierResult = { ok: true as const }, proposalResult = { ok: true as const, proposalId: 'prop-1' } } = options;
  const registry = new SessionBindingRegistry();
  if (bound) registry.register(SESSION, BOUND);
  const applier: StepOutputApplier = {
    apply: vi.fn(async () => applierResult as { ok: true } | { ok: false; error: string; code?: McpErrorCode }),
  };
  const proposalSubmitter = { submit: vi.fn(async () => proposalResult) };
  const tool = createSubmitOutputTool({
    bindingRegistry: registry,
    treeReader: readerOf(readResult),
    applier,
    oneShotTargetStore: new OneShotTargetStore(),
    proposalSubmitter,
  });
  return { tool, applier, proposalSubmitter };
}

interface WriteHarnessOptions {
  bound?: boolean;
  mutatorResult?: { ok: true } | { ok: false; error: string };
  proposalResult?: { ok: true; proposalId: string } | { ok: false; error: string };
}

function makeWriteTools(readResult: TreeReadResult, options: WriteHarnessOptions = {}) {
  const { bound = true, mutatorResult = { ok: true as const }, proposalResult = { ok: true as const, proposalId: 'prop-1' } } = options;
  const registry = new SessionBindingRegistry();
  if (bound) registry.register(SESSION, BOUND);
  const treeMutator: TreeMutator = { mutate: vi.fn(async () => mutatorResult) };
  const proposalSubmitter = { submit: vi.fn(async () => proposalResult) };
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

// The code travels as a structured field alongside the prose, never inside
// content[0].text for error results. The loose accessor reads the structured
// field without coupling the test to the ToolResult index-signature type.
function codeOf(result: ToolResult): string | undefined {
  return (result.structuredContent as { code?: string } | undefined)?.code;
}

function lastWarnLine(): string {
  const calls = vi.mocked(logger.warn).mock.calls;
  return calls.length > 0 ? String(calls[calls.length - 1][0]) : '';
}

beforeEach(() => {
  vi.mocked(logger.warn).mockClear();
  vi.mocked(logger.info).mockClear();
});

describe('submit_step_output — read-path kinds carry their codes with prose unchanged', () => {
  it.each([
    ['not-ready', 'read/not-ready'],
    ['no-session-store', 'read/no-session-store'],
    ['node-not-in-open-store', 'read/node-not-in-open-store'],
  ] as const)('%s yields code %s alongside the existing prose', async (kind, code) => {
    const { tool } = makeSubmitTool({ kind });

    const result = await tool.submitStepOutput({ sessionId: SESSION, targetNodeId: BOUND, content: 'output' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe(code);
    expect(textOf(result)).toContain(BOUND);
    expect(textOf(result)).toContain(SESSION);
  });
});

describe('submit_step_output — unbound stays success-shaped with the code inside the JSON payload', () => {
  it('returns applied=false with code write/unbound in the payload, not an error result', async () => {
    const { tool } = makeSubmitTool({ kind: 'ok', state: makeState() }, { bound: false });

    const result = await tool.submitStepOutput({ sessionId: 'sess-unbound', content: 'output' });

    expect(result.isError).toBeFalsy();
    const payload = JSON.parse(textOf(result)) as { applied: boolean; reason: string; code?: string };
    expect(payload.applied).toBe(false);
    expect(payload.reason).toContain('unbound');
    expect(payload.code).toBe('write/unbound');
  });
});

describe('submit_step_output — gate refusals carry codes and matching log lines', () => {
  it('no applied context yields write/no-context with the existing prose verbatim', async () => {
    const { tool } = makeSubmitTool({ kind: 'ok', state: makeState({ contextFlags: null }) });

    const result = await tool.submitStepOutput({ sessionId: SESSION, targetNodeId: BOUND, content: 'output' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/no-context');
    expect(textOf(result)).toBe(
      'No context is applied to the bound step. submit_step_output requires an explicitly applied collaborate context.',
    );
    expect(lastWarnLine()).toContain('write/no-context');
  });

  it('an execute-only context yields write/mode-refusal with the policy prose verbatim', async () => {
    const { tool } = makeSubmitTool({
      kind: 'ok',
      state: makeState({ contextFlags: { collaborate: false, execute: true } }),
    });

    const result = await tool.submitStepOutput({ sessionId: SESSION, targetNodeId: BOUND, content: 'output' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/mode-refusal');
    expect(textOf(result)).toBe(MODE_POLICY.execute.submitRefusal);
    expect(lastWarnLine()).toContain('write/mode-refusal');
  });

  it('a missing token on the autonomous route yields write/missing-token and the gate-miss log carries the code', async () => {
    const { tool } = makeSubmitTool({ kind: 'ok', state: makeState() });

    const result = await tool.submitStepOutput({ sessionId: SESSION, content: 'output' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/missing-token');
    expect(textOf(result)).toContain(BOUND);
    expect(lastWarnLine()).toContain('write/missing-token');
  });

  it('target drift on the autonomous route yields write/target-drift and the gate-miss log carries the code', async () => {
    const { tool } = makeSubmitTool({ kind: 'ok', state: makeState() });

    const result = await tool.submitStepOutput({ sessionId: SESSION, targetNodeId: OUTSIDE, content: 'output' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/target-drift');
    expect(textOf(result)).toContain(OUTSIDE);
    expect(textOf(result)).toContain(BOUND);
    expect(lastWarnLine()).toContain('write/target-drift');
  });

  it('target drift on the proposal route yields the same write/target-drift code', async () => {
    const { tool } = makeSubmitTool({ kind: 'ok', state: makeState({ stepType: null }) });

    const result = await tool.submitStepOutput({ sessionId: SESSION, targetNodeId: OUTSIDE, content: 'output' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/target-drift');
    expect(lastWarnLine()).toContain('write/target-drift');
  });
});

describe('submit_step_output — downstream failures', () => {
  it('an applier failure surfaces the applier sub-namespace code delivered over IPC', async () => {
    const { tool } = makeSubmitTool(
      { kind: 'ok', state: makeState() },
      { applierResult: { ok: false, error: `Node ${BOUND} not found`, code: 'applier/node-not-found' } },
    );

    const result = await tool.submitStepOutput({ sessionId: SESSION, targetNodeId: BOUND, content: 'output' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('applier/node-not-found');
    expect(textOf(result)).toBe(`Node ${BOUND} not found`);
  });

  it('an applier failure without a code falls back to write/upstream-failure rather than leaking an uncoded error', async () => {
    const { tool } = makeSubmitTool(
      { kind: 'ok', state: makeState() },
      { applierResult: { ok: false, error: 'legacy applier failure' } },
    );

    const result = await tool.submitStepOutput({ sessionId: SESSION, targetNodeId: BOUND, content: 'output' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/upstream-failure');
    expect(textOf(result)).toBe('legacy applier failure');
  });

  it('a proposal bridge failure yields the generic write/upstream-failure wrapper code', async () => {
    const { tool } = makeSubmitTool(
      { kind: 'ok', state: makeState({ stepType: null }) },
      { proposalResult: { ok: false, error: 'proposal bridge unavailable' } },
    );

    const result = await tool.submitStepOutput({ sessionId: SESSION, targetNodeId: BOUND, content: 'output' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/upstream-failure');
    expect(textOf(result)).toBe('proposal bridge unavailable');
  });
});

describe('submit_step_output — success paths gain no error code', () => {
  it('a successful autonomous apply carries no code field', async () => {
    const { tool } = makeSubmitTool({ kind: 'ok', state: makeState() });

    const result = await tool.submitStepOutput({ sessionId: SESSION, targetNodeId: BOUND, content: 'output' });

    expect(result.isError).toBeFalsy();
    expect(JSON.parse(textOf(result))).toEqual({ applied: true });
    expect(codeOf(result)).toBeUndefined();
  });
});

describe('read tools — the unbound-session precondition shares the write/unbound code', () => {
  it('getNode on an unbound session yields write/unbound with the existing prose', async () => {
    const registry = new SessionBindingRegistry();
    const tools = createReadTools({
      bindingRegistry: registry,
      treeReader: readerOf({ kind: 'ok', state: makeState() }),
    });

    const result = await tools.getNode({ sessionId: 'sess-unbound' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/unbound');
    expect(textOf(result)).toContain('No binding found for session sess-unbound');
  });
});

describe('write tools — gate refusals carry codes with prose unchanged', () => {
  it('an unbound session yields write/unbound with the existing prose', async () => {
    const tools = makeWriteTools({ kind: 'ok', state: makeState() }, { bound: false });

    const result = await tools.appendToNode({ sessionId: 'sess-unbound', content: 'x' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/unbound');
    expect(textOf(result)).toContain('No binding found for session sess-unbound');
  });

  it.each([
    ['not-ready', 'read/not-ready'],
    ['no-session-store', 'read/no-session-store'],
    ['node-not-in-open-store', 'read/node-not-in-open-store'],
  ] as const)('a %s read failure yields code %s through resolveBoundState', async (kind, code) => {
    const tools = makeWriteTools({ kind });

    const result = await tools.appendToNode({ sessionId: SESSION, content: 'x' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe(code);
  });

  it('a context-less bound step yields write/no-context with the existing prose verbatim', async () => {
    const tools = makeWriteTools({ kind: 'ok', state: makeState({ contextFlags: null }) });

    const result = await tools.appendToNode({ sessionId: SESSION, content: 'x' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/no-context');
    expect(textOf(result)).toBe(
      'No context is applied to the bound step. Tree-modifying tools require an explicitly applied context.',
    );
  });

  it('a disallowed mutation kind yields write/mode-refusal with the policy prose verbatim', async () => {
    const tools = makeWriteTools({
      kind: 'ok',
      state: makeState({ contextFlags: { collaborate: false, execute: true } }),
    });

    const result = await tools.appendToNode({ sessionId: SESSION, content: 'x' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/mode-refusal');
    expect(textOf(result)).toBe(MODE_POLICY.execute.mutationRefusal);
  });

  it('a node_id outside the bound subtree yields write/outside-bound-subtree', async () => {
    const tools = makeWriteTools({
      kind: 'ok',
      state: makeState({ contextFlags: { collaborate: true, execute: true } }),
    });

    const result = await tools.markStepComplete({ sessionId: SESSION, status: 'completed', node_id: OUTSIDE });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/outside-bound-subtree');
    expect(textOf(result)).toContain(OUTSIDE);
    expect(textOf(result)).toContain(BOUND);
  });

  it('a mutator failure on the direct-apply route yields write/upstream-failure with the upstream prose', async () => {
    const tools = makeWriteTools(
      { kind: 'ok', state: makeState({ contextFlags: { collaborate: true, execute: true } }) },
      { mutatorResult: { ok: false, error: 'mutation rejected by store' } },
    );

    const result = await tools.appendToNode({ sessionId: SESSION, content: 'x' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/upstream-failure');
    expect(textOf(result)).toBe('mutation rejected by store');
  });

  it('a proposal bridge failure on the proposal route yields write/upstream-failure', async () => {
    const tools = makeWriteTools(
      { kind: 'ok', state: makeState({ stepType: null }) },
      { proposalResult: { ok: false, error: 'proposal bridge unavailable' } },
    );

    const result = await tools.appendToNode({ sessionId: SESSION, content: 'x' });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/upstream-failure');
    expect(textOf(result)).toBe('proposal bridge unavailable');
  });
});

describe('announce_step_done — refusal codes', () => {
  it('a context-less bound step yields write/no-context', async () => {
    const tools = makeWriteTools({ kind: 'ok', state: makeState({ contextFlags: null }) });

    const result = await tools.announceStepDone({ sessionId: SESSION });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/no-context');
  });

  it('a collaborate-mode step yields write/mode-refusal with the announce policy prose verbatim', async () => {
    const tools = makeWriteTools({ kind: 'ok', state: makeState() });

    const result = await tools.announceStepDone({ sessionId: SESSION });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/mode-refusal');
    expect(textOf(result)).toBe(MODE_POLICY.collaborate.announceRefusal);
  });

  it('a manual step in an announce-completing mode yields write/manual-step', async () => {
    const tools = makeWriteTools({
      kind: 'ok',
      state: makeState({ contextFlags: { collaborate: false, execute: true }, stepType: null }),
    });

    const result = await tools.announceStepDone({ sessionId: SESSION });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/manual-step');
    expect(textOf(result)).toContain('autonomous or checkpoint');
  });

  it('a mark-complete mutator failure yields write/upstream-failure', async () => {
    const tools = makeWriteTools(
      { kind: 'ok', state: makeState({ contextFlags: { collaborate: false, execute: true } }) },
      { mutatorResult: { ok: false, error: 'mark-complete rejected' } },
    );

    const result = await tools.announceStepDone({ sessionId: SESSION });

    expect(result.isError).toBe(true);
    expect(codeOf(result)).toBe('write/upstream-failure');
    expect(textOf(result)).toBe('mark-complete rejected');
  });
});
