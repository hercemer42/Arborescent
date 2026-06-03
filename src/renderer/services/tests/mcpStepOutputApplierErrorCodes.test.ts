import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));
vi.mock('../../store/storeOwnership', () => ({
  findStoreOwningSession: vi.fn(),
}));

import { applyStepOutput, startMcpStepOutputApplierService } from '../mcpStepOutputApplierService';
import { findStoreOwningSession } from '../../store/storeOwnership';
import { TreeNode } from '../../../shared/types';
import type { StepOutputApplyRequest } from '../../../shared/types/electronApi';

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const STEP = 'cccccccc-cccc-cccc-cccc-cccccccccc03';

// The applier sub-namespace: each of the five distinct failure modes carries
// its own machine-readable code on the ApplyResult, so the submit tool can
// deliver it to the MCP client across the renderer→main IPC boundary. The
// prose error stays untouched. Codes are read through a loose accessor to
// stay decoupled from the ApplyResult union narrowing.

interface TestState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  workflowExecutionStates: Record<string, unknown>;
  collaboratingNodeId: string | null;
  actions?: {
    autoSave?: () => void;
    handleAutonomousFeedback?: (nodeId: string, content: string) => void;
  };
}

function makeNode(id: string, content: string, metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children: [], metadata };
}

function makeFakeStore(
  workflowExecutionStates: Record<string, unknown> = {},
  stepMetadata: TreeNode['metadata'] = { stepType: 'autonomous' },
  actions: TestState['actions'] = { autoSave: vi.fn(), handleAutonomousFeedback: vi.fn() },
) {
  let state: TestState = {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root'),
      [STEP]: makeNode(STEP, 'Step', stepMetadata),
      [BOUND]: makeNode(BOUND, 'Bound'),
    },
    rootNodeId: ROOT,
    ancestorRegistry: { [ROOT]: [], [STEP]: [ROOT], [BOUND]: [ROOT, STEP] },
    workflowExecutionStates,
    collaboratingNodeId: null,
    actions,
  };
  return {
    store: {
      getState: () => state,
      setState: (partial: Partial<TestState>) => {
        state = { ...state, ...partial };
      },
    },
  };
}

function codeOf(result: { ok: boolean }): string | undefined {
  return (result as { code?: string }).code;
}

describe('applyStepOutput — applier failure codes', () => {
  it('a missing node yields applier/node-not-found with the prose untouched', () => {
    const { store } = makeFakeStore({}, {});

    const result = applyStepOutput(store as never, 'missing-node', 'x');

    expect(result.ok).toBe(false);
    expect(codeOf(result)).toBe('applier/node-not-found');
    if (!result.ok) expect(result.error).toContain('not found');
  });

  it('a workflow-active node without a handler yields applier/workflow-handler-unavailable', () => {
    const { store } = makeFakeStore(
      { [BOUND]: { state: 'running' } },
      { stepType: 'autonomous' },
      { autoSave: vi.fn() },
    );

    const result = applyStepOutput(store as never, BOUND, 'x');

    expect(result.ok).toBe(false);
    expect(codeOf(result)).toBe('applier/workflow-handler-unavailable');
    if (!result.ok) expect(result.error).toContain('Workflow handler unavailable');
  });

  it('a structurally autonomous node with no execution entry yields applier/routing-disagreement', () => {
    const { store } = makeFakeStore({});

    const result = applyStepOutput(store as never, BOUND, 'x');

    expect(result.ok).toBe(false);
    expect(codeOf(result)).toBe('applier/routing-disagreement');
    if (!result.ok) expect(result.error).toMatch(/gate|routing|autonomous/i);
  });

  it('a successful apply carries no code field', () => {
    const { store } = makeFakeStore({}, {});

    const result = applyStepOutput(store as never, BOUND, 'new content');

    expect(result.ok).toBe(true);
    expect(codeOf(result)).toBeUndefined();
  });
});

describe('startMcpStepOutputApplierService — request-level failure codes over IPC', () => {
  const ownerOf = findStoreOwningSession as unknown as Mock;

  function captureHandler(): (req: StepOutputApplyRequest) => void {
    let handler!: (req: StepOutputApplyRequest) => void;
    (window.electron.onMcpStepOutputApplyRequest as unknown as Mock).mockImplementation(
      (cb: (req: StepOutputApplyRequest) => void) => {
        handler = cb;
        return () => {};
      },
    );
    startMcpStepOutputApplierService();
    return handler;
  }

  function respondedResult(): { ok: boolean; error?: string } {
    const respond = window.electron.respondToMcpStepOutputApply as unknown as Mock;
    return respond.mock.calls[respond.mock.calls.length - 1][0].result;
  }

  beforeEach(() => {
    ownerOf.mockReset();
    (window.electron.onMcpStepOutputApplyRequest as unknown as Mock).mockReturnValue(vi.fn());
    (window.electron.respondToMcpStepOutputApply as unknown as Mock).mockResolvedValue(undefined);
  });

  it('no owning store yields applier/no-store with the prose untouched', () => {
    ownerOf.mockReturnValue(null);

    const handler = captureHandler();
    handler({ requestId: 'r1', sessionId: 'sess-unknown', nodeId: BOUND, content: 'x' });

    const result = respondedResult();
    expect(result.ok).toBe(false);
    expect(codeOf(result)).toBe('applier/no-store');
    expect(result.error).toContain('No open file owns session');
  });

  it('a throwing apply yields applier/applier-threw carrying the thrown message', () => {
    ownerOf.mockReturnValue({
      getState: () => {
        throw new Error('store exploded');
      },
      setState: () => {},
    });

    const handler = captureHandler();
    handler({ requestId: 'r2', sessionId: 'sess-1', nodeId: BOUND, content: 'x' });

    const result = respondedResult();
    expect(result.ok).toBe(false);
    expect(codeOf(result)).toBe('applier/applier-threw');
    expect(result.error).toBe('store exploded');
  });

  it('the five applier failure codes are mutually distinct', () => {
    const codes = new Set<string | undefined>();

    const { store: noNode } = makeFakeStore({}, {});
    codes.add(codeOf(applyStepOutput(noNode as never, 'missing-node', 'x')));

    const { store: noHandler } = makeFakeStore(
      { [BOUND]: { state: 'running' } },
      { stepType: 'autonomous' },
      { autoSave: vi.fn() },
    );
    codes.add(codeOf(applyStepOutput(noHandler as never, BOUND, 'x')));

    const { store: divergent } = makeFakeStore({});
    codes.add(codeOf(applyStepOutput(divergent as never, BOUND, 'x')));

    ownerOf.mockReturnValue(null);
    const handler = captureHandler();
    handler({ requestId: 'r3', sessionId: 'sess-x', nodeId: BOUND, content: 'x' });
    codes.add(codeOf(respondedResult()));

    ownerOf.mockReturnValue({
      getState: () => {
        throw new Error('boom');
      },
      setState: () => {},
    });
    handler({ requestId: 'r4', sessionId: 'sess-y', nodeId: BOUND, content: 'x' });
    codes.add(codeOf(respondedResult()));

    expect(codes.size).toBe(5);
    expect(codes.has(undefined)).toBe(false);
  });
});
