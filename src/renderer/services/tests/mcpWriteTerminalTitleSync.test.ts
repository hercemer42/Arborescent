import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { TreeNode } from '../../../shared/types';

// Bug: bound terminal tab titles only re-derive on direct user edits
// (nodeActions.updateContent → syncBoundTerminalTitles). Every programmatic
// write path — MCP submit_step_output direct apply, set_node_content,
// append_to_node — mutates node content via direct setState and never syncs,
// so the tab title stays as per the original node. These tests pin the
// contract that MCP writes to a bound node re-derive the terminal title with
// the same extractor and guards as the user-edit path.

vi.mock('../logger', () => ({
  logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { applyStepOutput } from '../mcpStepOutputApplierService';
import { applyMutation } from '../mcpTreeMutatorService';
import { useTerminalStore } from '../../store/terminal/terminalStore';

const ROOT = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa01';
const BOUND = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb02';
const CHILD = 'cccccccc-cccc-cccc-cccc-cccccccccc03';
const OTHER = 'dddddddd-dddd-dddd-dddd-dddddddddd04';

const FILE_PATH = '/project.arbo';

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

function makeNode(id: string, content: string, children: string[] = []): TreeNode {
  return { id, content, children, metadata: {} };
}

// Non-autonomous shape throughout: no stepType on any ancestor and no
// workflowExecutionStates entry, so applyStepOutput takes the direct-write
// branch rather than dispatching to handleAutonomousFeedback.
function makeFakeStore() {
  const autoSave = vi.fn();
  const handleAutonomousFeedback = vi.fn();
  let state: TestState = {
    nodes: {
      [ROOT]: makeNode(ROOT, 'Root', [BOUND, OTHER]),
      [BOUND]: makeNode(BOUND, 'Bound task', [CHILD]),
      [CHILD]: makeNode(CHILD, 'Child of bound', []),
      [OTHER]: makeNode(OTHER, 'Unrelated sibling', []),
    },
    rootNodeId: ROOT,
    ancestorRegistry: {
      [ROOT]: [],
      [BOUND]: [ROOT],
      [CHILD]: [ROOT, BOUND],
      [OTHER]: [ROOT],
    },
    workflowExecutionStates: {},
    collaboratingNodeId: null,
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

type TerminalSeed = { id: string; title: string; originNodeId?: string };

function setTerminals(seeds: TerminalSeed[]): void {
  const terminals = seeds.map((s) => ({
    id: s.id,
    title: s.title,
    cwd: '/tmp',
    originNodeId: s.originNodeId,
  })) as unknown as ReturnType<typeof useTerminalStore.getState>['terminals'];

  useTerminalStore.setState({
    terminals,
    activeTerminalId: seeds[0]?.id ?? null,
    currentFilePath: FILE_PATH,
    fileStates: {
      [FILE_PATH]: {
        terminals,
        activeTerminalId: seeds[0]?.id ?? null,
      },
    },
  });
}

function titleOf(terminalId: string): string | undefined {
  return useTerminalStore.getState().terminals.find((t) => t.id === terminalId)?.title;
}

function fileBucketTitleOf(terminalId: string): string | undefined {
  return useTerminalStore
    .getState()
    .fileStates[FILE_PATH]?.terminals.find((t) => t.id === terminalId)?.title;
}

beforeEach(() => {
  vi.clearAllMocks();
  setTerminals([{ id: 'term-1', title: 'Bound task', originNodeId: BOUND }]);
});

describe('applyStepOutput (MCP submit, direct-write path) — title sync happy path', () => {
  it('updates the bound terminal title when the step output rewrites the bound node content', () => {
    const { store } = makeFakeStore();

    const result = applyStepOutput(store as never, BOUND, 'Renamed via MCP submit\nbody');

    expect(result).toEqual({ ok: true });
    expect(titleOf('term-1')).toBe('Renamed via MCP submit');
  });

  it('propagates the update to the per-file fileStates bucket as well as the active mirror', () => {
    const { store } = makeFakeStore();

    applyStepOutput(store as never, BOUND, 'Renamed via MCP submit');

    expect(fileBucketTitleOf('term-1')).toBe('Renamed via MCP submit');
  });

  it('uses the first non-blank line of the submitted content, matching the user-edit extractor', () => {
    const { store } = makeFakeStore();

    applyStepOutput(store as never, BOUND, '\n\n  Real title  \nbody');

    expect(titleOf('term-1')).toBe('Real title');
  });

  it('strips control characters from the derived title, matching the bind-path extractor', () => {
    const { store } = makeFakeStore();

    applyStepOutput(store as never, BOUND, 'Hello\u0007world');

    expect(titleOf('term-1')).toBe('Helloworld');
  });
});

describe('applyStepOutput — title sync scoping and guards', () => {
  it('leaves terminals bound to other nodes untouched', () => {
    const { store } = makeFakeStore();
    setTerminals([
      { id: 'term-1', title: 'Bound task', originNodeId: BOUND },
      { id: 'term-2', title: 'Unrelated sibling', originNodeId: OTHER },
    ]);

    applyStepOutput(store as never, BOUND, 'Renamed via MCP submit');

    expect(titleOf('term-1')).toBe('Renamed via MCP submit');
    expect(titleOf('term-2')).toBe('Unrelated sibling');
  });

  it('does not touch terminals that have no originNodeId set', () => {
    const { store } = makeFakeStore();
    setTerminals([
      { id: 'term-1', title: 'Free terminal' },
      { id: 'term-2', title: 'Bound task', originNodeId: BOUND },
    ]);

    applyStepOutput(store as never, BOUND, 'Renamed via MCP submit');

    expect(titleOf('term-1')).toBe('Free terminal');
    expect(titleOf('term-2')).toBe('Renamed via MCP submit');
  });

  it('writing empty content leaves the existing terminal title intact (empty/whitespace guard parity)', () => {
    const { store } = makeFakeStore();

    applyStepOutput(store as never, BOUND, '');

    expect(titleOf('term-1')).toBe('Bound task');
  });

  it('writing whitespace-only content leaves the existing terminal title intact', () => {
    const { store } = makeFakeStore();

    applyStepOutput(store as never, BOUND, '   \n\t\n  ');

    expect(titleOf('term-1')).toBe('Bound task');
  });

  it('a failed apply (node not found) leaves every terminal title untouched', () => {
    const { store } = makeFakeStore();

    const before = useTerminalStore.getState().terminals;
    const result = applyStepOutput(store as never, 'ghost-node', 'Should not crash');
    const after = useTerminalStore.getState().terminals;

    expect(result.ok).toBe(false);
    expect(after).toBe(before);
    expect(titleOf('term-1')).toBe('Bound task');
  });

  it('a write whose extracted title equals the current title produces no terminal-store write (no-op identity)', () => {
    const { store } = makeFakeStore();

    const before = useTerminalStore.getState().terminals;
    applyStepOutput(store as never, BOUND, 'Bound task\nadded body line');
    const after = useTerminalStore.getState().terminals;

    expect(after).toBe(before);
    expect(titleOf('term-1')).toBe('Bound task');
  });

  it('repeated identical applies produce no terminal-store writes beyond the first sync', () => {
    const { store } = makeFakeStore();

    applyStepOutput(store as never, BOUND, 'New title');
    const afterFirst = useTerminalStore.getState().terminals;
    applyStepOutput(store as never, BOUND, 'New title');
    applyStepOutput(store as never, BOUND, 'New title');
    const afterRepeats = useTerminalStore.getState().terminals;

    expect(afterRepeats).toBe(afterFirst);
    expect(titleOf('term-1')).toBe('New title');
  });
});

describe('applyMutation set-content (MCP set_node_content) — title sync', () => {
  it('updates the bound terminal title when set-content rewrites the bound node', () => {
    const { store } = makeFakeStore();

    const result = applyMutation(store as never, BOUND, {
      kind: 'set-content',
      content: 'Renamed via set_node_content',
    });

    expect(result).toEqual({ ok: true });
    expect(titleOf('term-1')).toBe('Renamed via set_node_content');
  });

  it('set-content on a descendant of the bound node leaves the terminal title unchanged', () => {
    const { store } = makeFakeStore();

    applyMutation(store as never, CHILD, { kind: 'set-content', content: 'Renamed child' });

    expect(titleOf('term-1')).toBe('Bound task');
  });

  it('set-content on an unrelated node leaves the terminal title unchanged', () => {
    const { store } = makeFakeStore();

    applyMutation(store as never, OTHER, { kind: 'set-content', content: 'Renamed sibling' });

    expect(titleOf('term-1')).toBe('Bound task');
  });

  it('set-content with empty content leaves the existing terminal title intact', () => {
    const { store } = makeFakeStore();

    applyMutation(store as never, BOUND, { kind: 'set-content', content: '' });

    expect(titleOf('term-1')).toBe('Bound task');
  });

  it('a body-only edit below the first line produces no terminal-store write (no-op identity)', () => {
    const { store } = makeFakeStore();

    const before = useTerminalStore.getState().terminals;
    applyMutation(store as never, BOUND, {
      kind: 'set-content',
      content: 'Bound task\nnew body line',
    });
    const after = useTerminalStore.getState().terminals;

    expect(after).toBe(before);
    expect(titleOf('term-1')).toBe('Bound task');
  });
});

describe('applyMutation append (MCP append_to_node) — title sync', () => {
  it('re-derives the title when the appended suffix extends the first line', () => {
    const { store } = makeFakeStore();

    applyMutation(store as never, BOUND, { kind: 'append', content: ' — extended' });

    expect(titleOf('term-1')).toBe('Bound task — extended');
  });

  it('appending body lines (suffix starts with a newline) leaves the title unchanged with no store write', () => {
    const { store } = makeFakeStore();

    const before = useTerminalStore.getState().terminals;
    applyMutation(store as never, BOUND, { kind: 'append', content: '\nappended body' });
    const after = useTerminalStore.getState().terminals;

    expect(after).toBe(before);
    expect(titleOf('term-1')).toBe('Bound task');
  });

  it('appending to a bound node whose content is empty derives the title from the suffix', () => {
    const { store, getCurrent } = makeFakeStore();
    store.setState({
      nodes: { ...getCurrent().nodes, [BOUND]: makeNode(BOUND, '', [CHILD]) },
    });
    setTerminals([{ id: 'term-1', title: 'Stale title', originNodeId: BOUND }]);

    applyMutation(store as never, BOUND, { kind: 'append', content: 'Fresh title' });

    expect(titleOf('term-1')).toBe('Fresh title');
  });

  it('append on an unrelated node leaves the terminal title unchanged', () => {
    const { store } = makeFakeStore();

    applyMutation(store as never, OTHER, { kind: 'append', content: ' more' });

    expect(titleOf('term-1')).toBe('Bound task');
  });
});

describe('applyStepOutput — autonomous dispatch boundary', () => {
  it('routing to handleAutonomousFeedback leaves title sync to the workflow handler (no sync at the applier level)', () => {
    const { store, getCurrent, handleAutonomousFeedback } = makeFakeStore();
    store.setState({
      nodes: {
        ...getCurrent().nodes,
        [ROOT]: { ...getCurrent().nodes[ROOT], metadata: { stepType: 'autonomous' } },
      },
      workflowExecutionStates: { [BOUND]: { state: 'running', terminalTabId: 'term-1' } },
    });

    applyStepOutput(store as never, BOUND, 'Autonomous output title');

    expect(handleAutonomousFeedback).toHaveBeenCalledWith(BOUND, 'Autonomous output title');
    expect(titleOf('term-1')).toBe('Bound task');
  });
});

// The autonomous batch and originNodeId-migration cases are covered at unit
// level by resyncBoundTerminalTitles tests in
// store/terminal/tests/syncBoundTerminalTitles.test.ts. The remaining case
// pins a title only: the derivation rule for ancestor edits — bound node vs
// root vs nearest ancestor — is still undecided.
describe('title derivation across the tree — rule pending decision', () => {
  it.todo(
    'editing the parent of a bound node re-derives the bound terminal title per the decided derivation rule',
  );
});
