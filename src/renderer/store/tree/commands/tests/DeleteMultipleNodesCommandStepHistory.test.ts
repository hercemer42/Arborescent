import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteMultipleNodesCommand } from '../DeleteMultipleNodesCommand';
import { CutMultipleNodesCommand } from '../CutMultipleNodesCommand';
import type { StepHistoryEntry } from '../../stepHistory/stepHistory';
import type { TreeNode } from '@shared/types';

// Multi-node delete captures and restores step history exactly like
// DeleteNodeCommand does, so undoing a multi-delete of workflow steps never
// drops their history. The capture lives in DeleteMultipleNodesCommand only —
// CutMultipleNodesCommand shares the MultiNodeDeletionCommand base and must
// keep the base behavior.

function makeNode(
  id: string,
  content: string,
  children: string[] = [],
  metadata: Record<string, unknown> = {},
): TreeNode {
  return { id, content, children, metadata };
}

function makeEntry(rootId: string): StepHistoryEntry {
  return {
    id: `entry-${rootId}`,
    capturedAt: '2026-01-01T00:00:00.000Z',
    parentLabel: 'parent',
    rootNodeId: rootId,
    nodes: { [rootId]: makeNode(rootId, 'snap-content') },
    position: 0,
  };
}

type CommandStateSetter = (partial: Record<string, unknown>) => void;

describe('DeleteMultipleNodesCommand — step history capture and restore', () => {
  let state: {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    stepHistory: Record<string, StepHistoryEntry[]>;
  };
  let getState: () => typeof state;
  let setState: CommandStateSetter;
  let findPreviousNode: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      nodes: {
        root: makeNode('root', 'Root', ['workflow', 'plain']),
        workflow: makeNode('workflow', 'WF', ['step-1', 'step-2', 'step-3'], { isWorkflow: true }),
        'step-1': makeNode('step-1', 'Step One', [], { stepType: 'autonomous' }),
        'step-2': makeNode('step-2', 'Step Two', ['step-2a'], { stepType: 'autonomous' }),
        'step-2a': makeNode('step-2a', 'Nested Step', [], { stepType: 'autonomous' }),
        'step-3': makeNode('step-3', 'Step Three', [], { stepType: 'autonomous' }),
        plain: makeNode('plain', 'Plain', []),
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
        'step-2a': ['root', 'workflow', 'step-2'],
        'step-3': ['root', 'workflow'],
        plain: ['root'],
      },
      stepHistory: {
        'step-1': [makeEntry('snap-1a'), makeEntry('snap-1b')],
        'step-2': [makeEntry('snap-2')],
        'step-2a': [makeEntry('snap-2a')],
        'step-3': [makeEntry('snap-3')],
      },
    };
    getState = vi.fn(() => state);
    setState = vi.fn((partial: Record<string, unknown>) => {
      Object.assign(state, partial);
    });
    findPreviousNode = vi.fn(() => 'workflow');
  });

  function command(ids: string[]): DeleteMultipleNodesCommand {
    return new DeleteMultipleNodesCommand(
      ids,
      getState,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setState as any,
      findPreviousNode,
    );
  }

  it('removes step history of every deleted step on execute', () => {
    const cmd = command(['step-1', 'step-3']);
    cmd.execute();

    expect(state.stepHistory['step-1']).toBeUndefined();
    expect(state.stepHistory['step-3']).toBeUndefined();
  });

  it('restores step history intact for all deleted steps on undo', () => {
    const before = JSON.parse(JSON.stringify(state.stepHistory));

    const cmd = command(['step-1', 'step-3']);
    cmd.execute();
    cmd.undo();

    expect(state.stepHistory['step-1']).toEqual(before['step-1']);
    expect(state.stepHistory['step-3']).toEqual(before['step-3']);
  });

  it('round-trips step history of descendant steps inside a deleted subtree', () => {
    const before = JSON.parse(JSON.stringify(state.stepHistory));

    const cmd = command(['step-2']);
    cmd.execute();
    expect(state.stepHistory['step-2']).toBeUndefined();
    expect(state.stepHistory['step-2a']).toBeUndefined();

    cmd.undo();
    expect(state.stepHistory['step-2']).toEqual(before['step-2']);
    expect(state.stepHistory['step-2a']).toEqual(before['step-2a']);
  });

  it('does not touch step history of surviving steps across execute and undo', () => {
    const cmd = command(['step-1']);
    cmd.execute();
    expect(state.stepHistory['step-3']).toHaveLength(1);

    cmd.undo();
    expect(state.stepHistory['step-3']).toHaveLength(1);
  });

  it('survives a state with no stepHistory map at all', () => {
    // @ts-expect-error — exercising the undefined branch deliberately
    state.stepHistory = undefined;

    const cmd = command(['step-1', 'step-3']);
    expect(() => {
      cmd.execute();
      cmd.undo();
    }).not.toThrow();
    expect(state.nodes['step-1']).toBeDefined();
    expect(state.nodes['step-3']).toBeDefined();
  });

  it('handles deleted nodes that have no step history entries', () => {
    const cmd = command(['plain', 'step-1']);
    cmd.execute();
    cmd.undo();

    expect(state.nodes['plain']).toBeDefined();
    expect(state.stepHistory['step-1']).toHaveLength(2);
    expect(state.stepHistory['plain']).toBeUndefined();
  });

  it('keeps the deletion a single atomic command — execute then undo restores the exact pre-delete tree', () => {
    const beforeNodes = JSON.parse(JSON.stringify(state.nodes));
    const beforeHistory = JSON.parse(JSON.stringify(state.stepHistory));

    const cmd = command(['step-1', 'step-2', 'step-3']);
    cmd.execute();
    cmd.undo();

    expect(state.nodes).toEqual(beforeNodes);
    expect(state.stepHistory).toEqual(beforeHistory);
  });
});

describe('CutMultipleNodesCommand — step history behavior unchanged by the delete fix', () => {
  let state: {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    stepHistory: Record<string, StepHistoryEntry[]>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      nodes: {
        root: makeNode('root', 'Root', ['workflow']),
        workflow: makeNode('workflow', 'WF', ['step-1', 'step-2'], { isWorkflow: true }),
        'step-1': makeNode('step-1', 'Step One', [], { stepType: 'autonomous' }),
        'step-2': makeNode('step-2', 'Step Two', [], { stepType: 'autonomous' }),
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
        'step-2': ['root', 'workflow'],
      },
      stepHistory: {
        'step-1': [makeEntry('snap-1')],
      },
    };
  });

  it('does not clear step history on execute — Cut keeps the base behavior', () => {
    const before = JSON.parse(JSON.stringify(state.stepHistory));
    const cmd = new CutMultipleNodesCommand(
      ['step-1', 'step-2'],
      () => state,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ((partial: Record<string, unknown>) => Object.assign(state, partial)) as any,
      () => 'workflow',
    );

    cmd.execute();

    expect(state.stepHistory).toEqual(before);
  });
});
