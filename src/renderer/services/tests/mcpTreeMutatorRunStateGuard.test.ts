import { describe, it, expect, vi } from 'vitest';

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { applyMutation } from '../mcpTreeMutatorService';
import { TreeNode } from '../../../shared/types';
import type { MutationRequest } from '../../../shared/types/electronApi';

// The "node is not in play" run-state guard.
//
// When the user stops a running workflow mid-prompt, stopWorkflow deletes the
// node's entry from workflowExecutionStates. The AI's later announce_step_done /
// mark_step_complete route through the main-process WriteTools → treeMutator →
// this renderer handler's applyMutation. The main process cannot see
// workflowExecutionStates, so this handler is the only seam that can tell the
// node was stopped — applyMarkComplete refuses there rather than marking the
// stopped step done and advancing the workflow the user stopped.
//
// The guard: when the bound node is structurally autonomous (its immediate
// parent is an autonomous step) but has NO workflowExecutionStates entry, a
// mark-complete is refused (ok:false) and the node is not mutated. A node with a
// running OR awaiting-validation entry is still in play and applies. Non-workflow
// nodes (no autonomous parent) are unaffected.

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const STEP = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';

interface TestState {
  nodes: Record<string, TreeNode>;
  rootNodeId: string;
  ancestorRegistry: Record<string, string[]>;
  workflowExecutionStates: Record<string, unknown>;
  actions?: { autoSave?: () => void };
}

function makeNode(id: string, content: string, metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children: [], metadata };
}

// The session binds to the SUBJECT (BOUND); autonomy is read from its immediate
// parent STEP. Pass stepMetadata={} to model a non-workflow node. The default
// stepType='autonomous' makes BOUND structurally autonomous, so the guard's
// in-play check applies to it.
function makeFakeStore(
  workflowExecutionStates: Record<string, unknown> = {},
  stepMetadata: TreeNode['metadata'] = { stepType: 'autonomous' },
) {
  const autoSave = vi.fn();
  let state: TestState = {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root'),
      [STEP]: makeNode(STEP, 'Step', stepMetadata),
      [BOUND]: makeNode(BOUND, 'Bound'),
    },
    rootNodeId: ROOT,
    ancestorRegistry: { [ROOT]: [], [STEP]: [ROOT], [BOUND]: [ROOT, STEP] },
    workflowExecutionStates,
    actions: { autoSave },
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
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyAs(store: any, nodeId: string, request: MutationRequest) {
  return applyMutation(store, nodeId, request);
}

const MARK_COMPLETE: MutationRequest = { kind: 'mark-complete', status: 'completed' };

describe('applyMutation — run-state guard refuses writes against a stopped (not-in-play) node', () => {
  it('refuses mark-complete on a structurally-autonomous node whose workflowExecutionStates entry was cleared by stopWorkflow', () => {
    const { store } = makeFakeStore({}); // autonomous parent, no exec entry == stopped
    const result = applyAs(store, BOUND, MARK_COMPLETE);
    expect(result.ok).toBe(false);
  });

  it('does not mutate the node status when the write is refused (the stopped step stays pending, the workflow does not advance)', () => {
    const { store, getCurrent } = makeFakeStore({});
    applyAs(store, BOUND, MARK_COMPLETE);
    expect(getCurrent().nodes[BOUND].metadata.status).not.toBe('completed');
  });

  it('does not trigger autoSave when the write is refused', () => {
    const { store, autoSave } = makeFakeStore({});
    applyAs(store, BOUND, MARK_COMPLETE);
    expect(autoSave).not.toHaveBeenCalled();
  });

  it('the refusal message identifies the node as not in play / not running rather than reading as a generic failure', () => {
    const { store } = makeFakeStore({});
    const result = applyAs(store, BOUND, MARK_COMPLETE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/not in play|not running|no longer running|not currently running|stopped/i);
    }
  });

  it('carries the write/node-not-running code so the write tool surfaces a dedicated MCP error, not a generic upstream failure', () => {
    const { store } = makeFakeStore({});
    const result = applyAs(store, BOUND, MARK_COMPLETE);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('write/node-not-running');
    }
  });

  it('keeps refusing on a repeated mark-complete after the stop — the refusal is idempotent and never advances late', () => {
    const { store, getCurrent } = makeFakeStore({});
    const first = applyAs(store, BOUND, MARK_COMPLETE);
    const second = applyAs(store, BOUND, MARK_COMPLETE);
    expect(first.ok).toBe(false);
    expect(second.ok).toBe(false);
    expect(getCurrent().nodes[BOUND].metadata.status).not.toBe('completed');
  });
});

describe('applyMutation — run-state guard stays clear of nodes that are genuinely in play (regression pins)', () => {
  it('still applies mark-complete when the node has a running workflowExecutionStates entry', () => {
    const { store, getCurrent } = makeFakeStore({ [BOUND]: { state: 'running', terminalTabId: 'term-1' } });
    const result = applyAs(store, BOUND, MARK_COMPLETE);
    expect(result).toEqual({ ok: true });
    expect(getCurrent().nodes[BOUND].metadata.status).toBe('completed');
  });

  it('still applies mark-complete when the node is awaiting-validation — the workflow still owns it', () => {
    const { store, getCurrent } = makeFakeStore({ [BOUND]: { state: 'awaiting-validation' } });
    const result = applyAs(store, BOUND, MARK_COMPLETE);
    expect(result).toEqual({ ok: true });
    expect(getCurrent().nodes[BOUND].metadata.status).toBe('completed');
  });

  it('does not guard a non-workflow node — mark-complete on a node with no autonomous parent still applies', () => {
    const { store, getCurrent } = makeFakeStore({}, {}); // parent step carries no stepType
    const result = applyAs(store, BOUND, MARK_COMPLETE);
    expect(result).toEqual({ ok: true });
    expect(getCurrent().nodes[BOUND].metadata.status).toBe('completed');
  });

  it('does not guard a sibling mutation that is not the subject — append on a running node is unaffected', () => {
    const { store, getCurrent } = makeFakeStore({ [BOUND]: { state: 'running' } });
    const result = applyAs(store, BOUND, { kind: 'append', content: ' tail' });
    expect(result).toEqual({ ok: true });
    expect(getCurrent().nodes[BOUND].content).toBe('Bound tail');
  });
});

