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
  actions?: { autoSave?: () => void };
}

function makeNode(id: string, content: string, metadata: TreeNode['metadata'] = {}): TreeNode {
  return { id, content, children: [], metadata };
}

function makeFakeStore(
  workflowExecutionStates: Record<string, unknown> = {},
  collaboratingNodeId: string | null = null,
) {
  const autoSave = vi.fn();
  let state: TestState = {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root'),
      [BOUND]: makeNode(BOUND, 'Bound', { stepType: 'autonomous' }),
    },
    rootNodeId: ROOT,
    ancestorRegistry: { [ROOT]: [], [BOUND]: [ROOT] },
    workflowExecutionStates,
    collaboratingNodeId,
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

describe('applyStepOutput — happy path', () => {
  it('replaces the bound node content and triggers autoSave', () => {
    const { store, getCurrent, autoSave } = makeFakeStore();
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

describe('applyStepOutput — workflow-active guard', () => {
  // The feedback-file pipeline owns content for any node with an active workflow
  // execution entry. The Stop-hook safety net carries chat text (not parsed
  // feedback markdown) — applying it would clobber the file watcher's correct
  // result. Skip; main-side marker still dedupes Claude's explicit call this turn.
  it('skips the apply when the bound node has an active workflow execution entry', () => {
    const { store, getCurrent, autoSave } = makeFakeStore({
      [BOUND]: { state: 'running', terminalTabId: 'term-1' },
    });
    const result = applyStepOutput(store as never, BOUND, 'auto-submit chat text');
    expect(result).toEqual({ ok: true });
    // Content is unchanged — file-watcher pipeline owns this turn
    expect(getCurrent().nodes[BOUND].content).toBe('Bound');
    expect(autoSave).not.toHaveBeenCalled();
  });

  it('applies normally when the bound node has no workflow execution entry (free terminal use)', () => {
    const { store, getCurrent } = makeFakeStore({});
    applyStepOutput(store as never, BOUND, 'free claude response');
    expect(getCurrent().nodes[BOUND].content).toBe('free claude response');
  });

  it('skips even for an awaiting-validation entry — checkpoint resumption is the file-watcher path', () => {
    const { store, getCurrent } = makeFakeStore({
      [BOUND]: { state: 'awaiting-validation' },
    });
    applyStepOutput(store as never, BOUND, 'x');
    expect(getCurrent().nodes[BOUND].content).toBe('Bound');
  });

  it('skips for a stuck entry — auto-recovery via file watcher should still take precedence', () => {
    const { store, getCurrent } = makeFakeStore({
      [BOUND]: { state: 'stuck' },
    });
    applyStepOutput(store as never, BOUND, 'x');
    expect(getCurrent().nodes[BOUND].content).toBe('Bound');
  });

  it('skips when collaboratingNodeId points at the bound node (manual terminal collab awaiting feedback-panel review)', () => {
    // Manual terminal sends do NOT populate workflowExecutionStates but DO set
    // collaboratingNodeId. The Stop-hook safety net would otherwise clobber the
    // node content with Claude's chat text before the user reviews in the panel.
    const { store, getCurrent, autoSave } = makeFakeStore({}, BOUND);
    const result = applyStepOutput(store as never, BOUND, 'auto-submit chat text');
    expect(result).toEqual({ ok: true });
    expect(getCurrent().nodes[BOUND].content).toBe('Bound');
    expect(autoSave).not.toHaveBeenCalled();
  });

  it('applies when collaboratingNodeId is a different node — the safety net is allowed for an unrelated bound session', () => {
    const { store, getCurrent } = makeFakeStore({}, ROOT);
    applyStepOutput(store as never, BOUND, 'free response');
    expect(getCurrent().nodes[BOUND].content).toBe('free response');
  });
});
