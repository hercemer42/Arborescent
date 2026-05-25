import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DeleteNodeCommand } from '../DeleteNodeCommand';
import type { StepHistoryEntry } from '../../stepHistory/stepHistory';
import type { TreeNode } from '@shared/types';

vi.mock('../../../files/filesStore', () => ({
  useFilesStore: {
    getState: () => ({ closeZoomTabsForNode: vi.fn() }),
  },
}));

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

describe('DeleteNodeCommand — step history preservation', () => {
  let state: {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    stepHistory: Record<string, StepHistoryEntry[]>;
  };
  let getState: () => typeof state;
  let setState: ReturnType<typeof vi.fn>;
  let findPreviousNode: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      nodes: {
        root: makeNode('root', 'Root', ['workflow']),
        workflow: makeNode('workflow', 'WF', ['step-1'], { isWorkflow: true }),
        'step-1': makeNode('step-1', 'Step One', [], { stepType: 'autonomous' }),
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
      },
      stepHistory: {
        'step-1': [makeEntry('snap-a'), makeEntry('snap-b')],
      },
    };
    getState = vi.fn(() => state);
    setState = vi.fn((partial: Partial<typeof state>) => {
      Object.assign(state, partial);
    });
    findPreviousNode = vi.fn(() => 'workflow');
  });

  it('removes the step history alongside the deleted step on execute', () => {
    const cmd = new DeleteNodeCommand('step-1', getState, setState, findPreviousNode);
    cmd.execute();
    expect(state.stepHistory?.['step-1']).toBeUndefined();
  });

  it('restores the deleted step’s history intact on undo', () => {
    const before = JSON.parse(JSON.stringify(state.stepHistory['step-1']));
    const cmd = new DeleteNodeCommand('step-1', getState, setState, findPreviousNode);
    cmd.execute();
    cmd.undo();
    expect(state.stepHistory['step-1']).toEqual(before);
  });

  it('does not touch other steps’ histories', () => {
    state.nodes.workflow.children = ['step-1', 'step-2'];
    state.nodes['step-2'] = makeNode('step-2', 'Step Two', [], { stepType: 'autonomous' });
    state.ancestorRegistry['step-2'] = ['root', 'workflow'];
    state.stepHistory['step-2'] = [makeEntry('untouched')];

    const cmd = new DeleteNodeCommand('step-1', getState, setState, findPreviousNode);
    cmd.execute();
    expect(state.stepHistory['step-2']).toHaveLength(1);
    cmd.undo();
    expect(state.stepHistory['step-2']).toHaveLength(1);
  });

  it('captures step history of every descendant step in the snapshot', () => {
    // step-1 contains a nested step-1a — both should be preserved.
    state.nodes['step-1'].children = ['step-1a'];
    state.nodes['step-1a'] = makeNode('step-1a', 'Nested Step', [], { stepType: 'autonomous' });
    state.ancestorRegistry['step-1a'] = ['root', 'workflow', 'step-1'];
    state.stepHistory['step-1a'] = [makeEntry('nested-snap')];

    const beforeStepOne = JSON.parse(JSON.stringify(state.stepHistory['step-1']));
    const beforeStepOneA = JSON.parse(JSON.stringify(state.stepHistory['step-1a']));

    const cmd = new DeleteNodeCommand('step-1', getState, setState, findPreviousNode);
    cmd.execute();
    expect(state.stepHistory['step-1']).toBeUndefined();
    expect(state.stepHistory['step-1a']).toBeUndefined();
    cmd.undo();
    expect(state.stepHistory['step-1']).toEqual(beforeStepOne);
    expect(state.stepHistory['step-1a']).toEqual(beforeStepOneA);
  });

  it('exposes step ids in touchedNodeIds so user-undo invalidation considers deletion of a step', () => {
    const cmd = new DeleteNodeCommand('step-1', getState, setState, findPreviousNode);
    expect(cmd.touchedNodeIds).toBeInstanceOf(Set);
    expect(cmd.touchedNodeIds!.has('step-1')).toBe(true);
  });
});
