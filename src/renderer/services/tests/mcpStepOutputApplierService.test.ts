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

// The session binds to the SUBJECT (BOUND), which travels through the
// workflow; autonomy is determined by its parent STEP's stepType. The subject
// never carries stepType. Pass stepMetadata={} to model a non-autonomous step
// (free-terminal / manual send).
function makeFakeStore(
  workflowExecutionStates: Record<string, unknown> = {},
  collaboratingNodeId: string | null = null,
  stepMetadata: TreeNode['metadata'] = { stepType: 'autonomous' },
) {
  const autoSave = vi.fn();
  const handleAutonomousFeedback = vi.fn();
  let state: TestState = {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root'),
      [STEP]: makeNode(STEP, 'Step', stepMetadata),
      [BOUND]: makeNode(BOUND, 'Bound'),
    },
    rootNodeId: ROOT,
    ancestorRegistry: { [ROOT]: [], [STEP]: [ROOT], [BOUND]: [ROOT, STEP] },
    workflowExecutionStates,
    collaboratingNodeId,
    actions: { autoSave, handleAutonomousFeedback },
  };
  return {
    store: {
      getState: () => state,
      setState: (partial: Partial<TestState>) => {
        state = { ...state, ...partial };
      },
    },
    getCurrent: () => state,
    autoSave,
    handleAutonomousFeedback,
  };
}

describe('startMcpStepOutputApplierService — file-scoped resolution (Ticket A, write path)', () => {
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

  beforeEach(() => {
    ownerOf.mockReset();
    (window.electron.onMcpStepOutputApplyRequest as unknown as Mock).mockReturnValue(vi.fn());
    (window.electron.respondToMcpStepOutputApply as unknown as Mock).mockResolvedValue(undefined);
  });

  it('applies to the store that owns the session, resolved by sessionId not by sweeping', () => {
    const { store, getCurrent } = makeFakeStore({}, null, {});
    ownerOf.mockReturnValue(store);

    const handler = captureHandler();
    handler({ requestId: 'r1', sessionId: 'sess-1', nodeId: BOUND, content: 'scoped write' });

    expect(ownerOf).toHaveBeenCalledWith('sess-1');
    expect(getCurrent().nodes[BOUND].content).toBe('scoped write');
    expect(window.electron.respondToMcpStepOutputApply).toHaveBeenCalledWith({
      requestId: 'r1',
      result: { ok: true },
    });
  });

  it('fails closed when no open file owns the session', () => {
    ownerOf.mockReturnValue(null);

    const handler = captureHandler();
    handler({ requestId: 'r2', sessionId: 'sess-unknown', nodeId: BOUND, content: 'x' });

    expect(window.electron.respondToMcpStepOutputApply).toHaveBeenCalledWith({
      requestId: 'r2',
      result: { ok: false, error: expect.stringContaining('No open file owns session'), code: 'applier/no-store' },
    });
  });
});

describe('applyStepOutput — happy path', () => {
  it('replaces the bound node content and triggers autoSave when the node is not in an active workflow run', () => {
    const { store, getCurrent, autoSave } = makeFakeStore({}, null, {});
    const result = applyStepOutput(store as never, BOUND, 'new content');
    expect(result).toEqual({ ok: true });
    expect(getCurrent().nodes[BOUND].content).toBe('new content');
    expect(autoSave).toHaveBeenCalledTimes(1);
  });

  it('errors when the bound node is not in the store', () => {
    const { store } = makeFakeStore();
    const result = applyStepOutput(store as never, 'missing-node', 'x');
    expect(result).toEqual({ ok: false, error: expect.stringContaining('not found'), code: 'applier/node-not-found' });
  });
});

describe('applyStepOutput — autonomous workflow dispatch', () => {
  // An autonomous workflow step is identified by a workflowExecutionStates
  // entry. Routing through handleAutonomousFeedback is the only path that
  // parses markdown, creates decomposition children, runs AcceptFeedbackCommand,
  // and advances or recurses. A direct content write would silently drop all of
  // that and dump multi-root markdown verbatim into one node.
  it('dispatches to handleAutonomousFeedback when the bound node has an active workflow execution entry', () => {
    const { store, handleAutonomousFeedback, autoSave } = makeFakeStore({
      [BOUND]: { state: 'running', terminalTabId: 'term-1' },
    });
    const result = applyStepOutput(store as never, BOUND, 'autonomous output');
    expect(result).toEqual({ ok: true });
    expect(handleAutonomousFeedback).toHaveBeenCalledWith(BOUND, 'autonomous output');
    // The direct content path is skipped — handleAutonomousFeedback owns the autosave.
    expect(autoSave).not.toHaveBeenCalled();
  });

  it('writes content directly when the bound node has no workflow execution entry AND is not structurally autonomous (free terminal use)', () => {
    const { store, getCurrent, handleAutonomousFeedback } = makeFakeStore({}, null, {});
    applyStepOutput(store as never, BOUND, 'free claude response');
    expect(getCurrent().nodes[BOUND].content).toBe('free claude response');
    expect(handleAutonomousFeedback).not.toHaveBeenCalled();
  });

  it('dispatches for an awaiting-validation entry — the workflow still owns the node', () => {
    const { store, handleAutonomousFeedback } = makeFakeStore({
      [BOUND]: { state: 'awaiting-validation' },
    });
    applyStepOutput(store as never, BOUND, 'x');
    expect(handleAutonomousFeedback).toHaveBeenCalledWith(BOUND, 'x');
  });

  it('ignores collaboratingNodeId — manual collab is routed via the proposal submitter, not the applier', () => {
    // The mcpSubmitOutputTool routes non-automatic steps to the proposalSubmitter
    // before ever reaching this applier, so the old "collaboratingNodeId guards
    // the applier" rule no longer applies.
    const { store, getCurrent, autoSave } = makeFakeStore({}, BOUND, {});
    applyStepOutput(store as never, BOUND, 'response');
    expect(getCurrent().nodes[BOUND].content).toBe('response');
    expect(autoSave).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the workflow handler is unavailable for a workflow-active node', () => {
    const autoSave = vi.fn();
    let state = {
      nodes: {
        [STEP]: makeNode(STEP, 'Step', { stepType: 'autonomous' }),
        [BOUND]: makeNode(BOUND, 'Bound'),
      },
      rootNodeId: STEP,
      ancestorRegistry: { [STEP]: [], [BOUND]: [STEP] },
      workflowExecutionStates: { [BOUND]: { state: 'running' } },
      collaboratingNodeId: null,
      actions: { autoSave },
    };
    const store = {
      getState: () => state,
      setState: (partial: Partial<typeof state>) => {
        state = { ...state, ...partial };
      },
    };
    const result = applyStepOutput(store as never, BOUND, 'x');
    expect(result).toEqual({
      ok: false,
      error: expect.stringContaining('Workflow handler unavailable'),
      code: 'applier/workflow-handler-unavailable',
    });
  });
});

// Gate 1+2 alignment: when the node is structurally autonomous but the renderer
// has no workflowExecutionStates entry at apply time, applyStepOutput must
// fail-fast rather than silently blob-writing raw markdown into the node.
describe('applyStepOutput — gate 1+2 alignment (fail-fast on routing divergence)', () => {
  it('refuses (does not blob-write) when the subject is under an autonomous step but the workflowExecutionStates entry is missing', () => {
    const { store, getCurrent, autoSave } = makeFakeStore({}); // parent step autonomous by default, no exec state
    const result = applyStepOutput(store as never, BOUND, 'late content');
    expect(result.ok).toBe(false);
    expect(getCurrent().nodes[BOUND].content).toBe('Bound');
    expect(autoSave).not.toHaveBeenCalled();
  });

  it('returns a structured error result identifying the gate disagreement (so the MCP caller sees the rejection rather than a silent apply)', () => {
    const { store } = makeFakeStore({});
    const result = applyStepOutput(store as never, BOUND, 'late content');
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.toLowerCase()).toMatch(/gate|routing|autonomous/);
    }
  });

  it('phrases the refusal as "not in play" so a submit after the run was stopped reads as a stopped-run rejection, not an internal error', () => {
    const { store } = makeFakeStore({});
    const result = applyStepOutput(store as never, BOUND, 'late content');
    expect(result.ok).toBe(false);
    if (result.ok === false) {
      expect(result.error.toLowerCase()).toContain('not in play');
    }
  });

  it('logs a structured warning when the gate-1+2 disagreement is detected so the gap stays observable in real sessions', async () => {
    const { logger } = await import('../logger');
    const warnMock = vi.mocked(logger.warn);
    warnMock.mockClear();
    const { store } = makeFakeStore({});
    applyStepOutput(store as never, BOUND, 'late content');
    expect(warnMock).toHaveBeenCalled();
  });

  it('still falls through to the legitimate direct-write path when the node is genuinely non-autonomous (no stepType, no autonomous parent) — preserves the free-claude / non-workflow direct send case', () => {
    const { store, getCurrent, autoSave } = makeFakeStore({}, null, {});
    const result = applyStepOutput(store as never, BOUND, 'free content');
    expect(result).toEqual({ ok: true });
    expect(getCurrent().nodes[BOUND].content).toBe('free content');
    expect(autoSave).toHaveBeenCalledTimes(1);
  });

  it('does not regress when both gates agree — autonomous + exec state present still dispatches to handleAutonomousFeedback', () => {
    const { store, handleAutonomousFeedback, autoSave } = makeFakeStore({
      [BOUND]: { state: 'running', terminalTabId: 'term-1' },
    });
    const result = applyStepOutput(store as never, BOUND, 'autonomous output');
    expect(result).toEqual({ ok: true });
    expect(handleAutonomousFeedback).toHaveBeenCalledWith(BOUND, 'autonomous output');
    expect(autoSave).not.toHaveBeenCalled();
  });
});
