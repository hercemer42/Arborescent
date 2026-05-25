import { describe, it, expect, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { applyStepOutput } from '../mcpStepOutputApplierService';
import { TreeNode } from '../../../shared/types';

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';

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
  collaboratingNodeId: string | null = null,
  boundMetadata: TreeNode['metadata'] = { stepType: 'autonomous' },
  rootMetadata: TreeNode['metadata'] = {},
) {
  const autoSave = vi.fn();
  const handleAutonomousFeedback = vi.fn();
  let state: TestState = {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', rootMetadata),
      [BOUND]: makeNode(BOUND, 'Bound', boundMetadata),
    },
    rootNodeId: ROOT,
    ancestorRegistry: { [ROOT]: [], [BOUND]: [ROOT] },
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

describe('applyStepOutput — happy path', () => {
  it('replaces the bound node content and triggers autoSave when the node is not in an active workflow run', () => {
    const { store, getCurrent, autoSave } = makeFakeStore({}, null, {}, {});
    const result = applyStepOutput(store as never, BOUND, 'new content');
    expect(result).toEqual({ ok: true });
    expect(getCurrent().nodes[BOUND].content).toBe('new content');
    expect(autoSave).toHaveBeenCalledTimes(1);
  });

  it('errors when the bound node is not in the store', () => {
    const { store } = makeFakeStore();
    const result = applyStepOutput(store as never, 'missing-node', 'x');
    expect(result).toEqual({ ok: false, error: expect.stringContaining('not found') });
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
    const { store, getCurrent, handleAutonomousFeedback } = makeFakeStore({}, null, {}, {});
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
    const { store, getCurrent, autoSave } = makeFakeStore({}, BOUND, {}, {});
    applyStepOutput(store as never, BOUND, 'response');
    expect(getCurrent().nodes[BOUND].content).toBe('response');
    expect(autoSave).toHaveBeenCalledTimes(1);
  });

  it('returns an error if the workflow handler is unavailable for a workflow-active node', () => {
    const autoSave = vi.fn();
    const STEP = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
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
    expect(result).toEqual({ ok: false, error: expect.stringContaining('Workflow handler unavailable') });
  });
});

// Gate 1+2 alignment: when the node is structurally autonomous but the renderer
// has no workflowExecutionStates entry at apply time, applyStepOutput must
// fail-fast rather than silently blob-writing raw markdown into the node.
describe('applyStepOutput — gate 1+2 alignment (fail-fast on routing divergence)', () => {
  it('refuses (does not blob-write) when bound node is structurally autonomous via metadata.stepType but workflowExecutionStates entry is missing', () => {
    const { store, getCurrent, autoSave } = makeFakeStore({}); // bound has stepType=autonomous by default, no exec state
    const result = applyStepOutput(store as never, BOUND, 'late content');
    expect(result.ok).toBe(false);
    expect(getCurrent().nodes[BOUND].content).toBe('Bound');
    expect(autoSave).not.toHaveBeenCalled();
  });

  it('refuses when bound node has no stepType but its parent has stepType="autonomous" and exec state is missing — same predicate as server isAutomatic', () => {
    // bound is plain, parent (ROOT) carries stepType=autonomous
    const { store, getCurrent, autoSave } = makeFakeStore({}, null, {}, { stepType: 'autonomous' });
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

  it('logs a structured warning when the gate-1+2 disagreement is detected so the gap stays observable in real sessions', async () => {
    const { logger } = await import('../logger');
    const warnMock = vi.mocked(logger.warn);
    warnMock.mockClear();
    const { store } = makeFakeStore({});
    applyStepOutput(store as never, BOUND, 'late content');
    expect(warnMock).toHaveBeenCalled();
  });

  it('still falls through to the legitimate direct-write path when the node is genuinely non-autonomous (no stepType, no autonomous parent) — preserves the free-claude / non-workflow direct send case', () => {
    const { store, getCurrent, autoSave } = makeFakeStore({}, null, {}, {});
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
