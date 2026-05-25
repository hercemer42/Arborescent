import { describe, it, expect } from 'vitest';
import type { TreeNode } from '../../types';
import { getAutonomousStepContext } from '../autonomousStepContext';

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

  it('returns { stepId, execState } when stepType="autonomous" is set directly on the node and workflowExecutionStates has an entry', () => {
    const execEntry = { state: 'running' as const };
    const state = makeState({
      nodes: {
        [ROOT]: makeNode(ROOT),
        [BOUND]: makeNode(BOUND, { stepType: 'autonomous' }),
      },
      ancestorRegistry: { [ROOT]: [], [BOUND]: [ROOT] },
      workflowExecutionStates: { [BOUND]: execEntry },
    });
    const result = getAutonomousStepContext(BOUND, state);
    expect(result).not.toBeNull();
    expect(result?.stepId).toBe(BOUND);
    expect(result?.execState).toBe(execEntry);
  });

  it('returns { stepId, execState } when stepType="autonomous" is inherited from the immediate parent — stepId resolves to that parent', () => {
    const execEntry = { state: 'running' as const };
    const state = makeState({ workflowExecutionStates: { [BOUND]: execEntry } });
    const result = getAutonomousStepContext(BOUND, state);
    expect(result).not.toBeNull();
    expect(result?.stepId).toBe(STEP);
    expect(result?.execState).toBe(execEntry);
  });

  it('returns null when stepType="autonomous" is set structurally but workflowExecutionStates entry is missing (gate 2 miss)', () => {
    const state = makeState({ workflowExecutionStates: {} });
    expect(getAutonomousStepContext(BOUND, state)).toBeNull();
  });

  it('returns null when stepType="autonomous" is set structurally and exec state exists but findOwningWorkflowStepId yields no parent step (gate 3 miss)', () => {
    // bound has stepType=autonomous directly, but the ancestor walk finds no step
    // (i.e., the node has no ancestors with stepType at all). The unified
    // predicate must still return null because gate 3 cannot resolve an owning
    // step distinct from the node itself.
    const execEntry = { state: 'running' as const };
    const state = makeState({
      nodes: {
        [BOUND]: makeNode(BOUND, { stepType: 'autonomous' }),
      },
      ancestorRegistry: { [BOUND]: [] },
      workflowExecutionStates: { [BOUND]: execEntry },
    });
    // Contract: when there is no parent step in the ancestor chain AND the
    // node is the step itself, the predicate may either return null (strict
    // owning-step required) or { stepId: BOUND, execState } (self is the step).
    // The test pins to the strict interpretation so gate 3 is the active guard.
    const result = getAutonomousStepContext(BOUND, state);
    expect(result).toBeNull();
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
