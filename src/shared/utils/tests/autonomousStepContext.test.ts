import { describe, it, expect } from 'vitest';
import type { TreeNode } from '../../types';
import {
  getAutonomousStepContext,
  resolveParentStepType,
  isAutonomousNodeNotInPlay,
} from '../autonomousStepContext';

// Unified gate predicate shared between gate 1 (server: mcpSubmitOutputTool),
// gate 2 (renderer: applyStepOutput), and gate 3 (renderer:
// handleAutonomousFeedback). All three call sites must derive their
// autonomous-step decision from this single function so they cannot disagree
// at apply time.

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const STEP = 'cccccccc-cccc-cccc-cccc-cccccccccc02';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb03';

function makeNode(id: string, metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content: id, children: [], metadata };
}

interface InputState {
  nodes: Record<string, TreeNode>;
  ancestorRegistry: Record<string, string[]>;
  workflowExecutionStates: Record<string, unknown>;
}

function makeState(overrides: Partial<InputState> = {}): InputState {
  return {
    nodes: {
      [ROOT]: makeNode(ROOT),
      [STEP]: makeNode(STEP, { stepType: 'autonomous' }),
      [BOUND]: makeNode(BOUND),
    },
    ancestorRegistry: {
      [ROOT]: [],
      [STEP]: [ROOT],
      [BOUND]: [ROOT, STEP],
    },
    workflowExecutionStates: {
      [BOUND]: { state: 'running' },
    },
    ...overrides,
  };
}

describe('getAutonomousStepContext — unified gate predicate', () => {
  it('returns null when the node has no stepType metadata and its parent has no stepType="autonomous" metadata', () => {
    const state = makeState({
      nodes: {
        [ROOT]: makeNode(ROOT),
        [BOUND]: makeNode(BOUND),
      },
      ancestorRegistry: { [ROOT]: [], [BOUND]: [ROOT] },
      workflowExecutionStates: {},
    });
    expect(getAutonomousStepContext(BOUND, state)).toBeNull();
  });

  it('returns { stepId, execState } when the bound subject sits under an autonomous step (parent carries stepType) — stepId resolves to that parent', () => {
    const execEntry = { state: 'running' as const };
    const state = makeState({ workflowExecutionStates: { [BOUND]: execEntry } });
    const result = getAutonomousStepContext(BOUND, state);
    expect(result).not.toBeNull();
    expect(result?.stepId).toBe(STEP);
    expect(result?.execState).toBe(execEntry);
  });

  it('returns null when the parent step is non-autonomous (manual) — the subject belongs to a step the user drives', () => {
    const state = makeState({
      nodes: {
        [ROOT]: makeNode(ROOT),
        [STEP]: makeNode(STEP, { stepType: 'manual' }),
        [BOUND]: makeNode(BOUND),
      },
      workflowExecutionStates: { [BOUND]: { state: 'running' as const } },
    });
    expect(getAutonomousStepContext(BOUND, state)).toBeNull();
  });

  it('returns null when the parent step is non-autonomous (checkpoint)', () => {
    const state = makeState({
      nodes: {
        [ROOT]: makeNode(ROOT),
        [STEP]: makeNode(STEP, { stepType: 'checkpoint' }),
        [BOUND]: makeNode(BOUND),
      },
      workflowExecutionStates: { [BOUND]: { state: 'running' as const } },
    });
    expect(getAutonomousStepContext(BOUND, state)).toBeNull();
  });

  it('returns null when the parent is an autonomous step but the workflowExecutionStates entry is missing (gate 2 miss)', () => {
    const state = makeState({ workflowExecutionStates: {} });
    expect(getAutonomousStepContext(BOUND, state)).toBeNull();
  });

  it('is deterministic — same input state and nodeId yield identical results across repeated calls', () => {
    const state = makeState();
    const a = getAutonomousStepContext(BOUND, state);
    const b = getAutonomousStepContext(BOUND, state);
    expect(a).toEqual(b);
  });

  it('does not mutate the input state', () => {
    const state = makeState();
    const snapshot = JSON.stringify(state);
    getAutonomousStepContext(BOUND, state);
    expect(JSON.stringify(state)).toBe(snapshot);
  });
});

describe('isAutonomousNodeNotInPlay — a stopped autonomous subject has no execution entry', () => {
  it('is true when the parent is an autonomous step but the workflowExecutionStates entry is missing (the state stopWorkflow leaves behind)', () => {
    const state = makeState({ workflowExecutionStates: {} });
    expect(isAutonomousNodeNotInPlay(BOUND, state)).toBe(true);
  });

  it('is false when the autonomous subject still has a running entry (in play)', () => {
    const state = makeState({ workflowExecutionStates: { [BOUND]: { state: 'running' } } });
    expect(isAutonomousNodeNotInPlay(BOUND, state)).toBe(false);
  });

  it('is false when the autonomous subject is awaiting-validation — the workflow still owns it', () => {
    const state = makeState({ workflowExecutionStates: { [BOUND]: { state: 'awaiting-validation' } } });
    expect(isAutonomousNodeNotInPlay(BOUND, state)).toBe(false);
  });

  it('is false for a non-autonomous subject regardless of execution state — only autonomous steps are gated', () => {
    const state = makeState({
      nodes: {
        [ROOT]: makeNode(ROOT),
        [STEP]: makeNode(STEP, { stepType: 'manual' }),
        [BOUND]: makeNode(BOUND),
      },
      workflowExecutionStates: {},
    });
    expect(isAutonomousNodeNotInPlay(BOUND, state)).toBe(false);
  });
});

describe('resolveParentStepType — the immediate parent step type of the bound subject', () => {
  it.each(['autonomous', 'checkpoint', 'manual'] as const)(
    'returns "%s" when the parent step carries that stepType',
    (stepType) => {
      const state = makeState({
        nodes: {
          [ROOT]: makeNode(ROOT),
          [STEP]: makeNode(STEP, { stepType }),
          [BOUND]: makeNode(BOUND),
        },
      });
      expect(resolveParentStepType(BOUND, state)).toBe(stepType);
    },
  );

  it('returns undefined when the parent step carries no stepType', () => {
    const state = makeState({
      nodes: {
        [ROOT]: makeNode(ROOT),
        [STEP]: makeNode(STEP),
        [BOUND]: makeNode(BOUND),
      },
    });
    expect(resolveParentStepType(BOUND, state)).toBeUndefined();
  });

  it('returns undefined when the node has no parent (root) or is missing from the tree', () => {
    const state = makeState({
      nodes: { [ROOT]: makeNode(ROOT) },
      ancestorRegistry: { [ROOT]: [] },
    });
    expect(resolveParentStepType(ROOT, state)).toBeUndefined();
    expect(resolveParentStepType('missing-node', state)).toBeUndefined();
  });
});
