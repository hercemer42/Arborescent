import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RestoreStepHistoryCommand } from '../RestoreStepHistoryCommand';
import type { StepHistoryEntry } from '../../stepHistory/stepHistory';
import type { TreeNode } from '@shared/types';

function makeNode(
  id: string,
  content: string,
  children: string[] = [],
  metadata: Record<string, unknown> = {},
): TreeNode {
  return { id, content, children, metadata };
}

function makeEntry(rootId: string, parentLabel = 'step-1', position = 0): StepHistoryEntry {
  return {
    id: `entry-${rootId}`,
    capturedAt: '2026-01-01T00:00:00.000Z',
    parentLabel,
    rootNodeId: rootId,
    nodes: {
      [rootId]: makeNode(rootId, 'snapshot content', ['child-a']),
      'child-a': makeNode('child-a', 'A', ['grand-a']),
      'grand-a': makeNode('grand-a', 'grand'),
    },
    position,
  };
}

describe('RestoreStepHistoryCommand', () => {
  let state: {
    nodes: Record<string, TreeNode>;
    rootNodeId: string;
    ancestorRegistry: Record<string, string[]>;
    stepHistory: Record<string, StepHistoryEntry[]>;
  };
  let getState: () => typeof state;
  let setState: ReturnType<typeof vi.fn>;
  let triggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    state = {
      nodes: {
        root: makeNode('root', 'Root', ['workflow']),
        workflow: makeNode('workflow', 'WF', ['step-1'], { isWorkflow: true }),
        'step-1': makeNode('step-1', 'Step', ['live-output']),
        'live-output': makeNode('live-output', 'live'),
      },
      rootNodeId: 'root',
      ancestorRegistry: {
        root: [],
        workflow: ['root'],
        'step-1': ['root', 'workflow'],
        'live-output': ['root', 'workflow', 'step-1'],
      },
      stepHistory: {
        'step-1': [makeEntry('snap-root-orig', 'step-1', 0)],
      },
    };
    getState = vi.fn(() => state);
    setState = vi.fn((partial: Partial<typeof state>) => {
      Object.assign(state, partial);
    });
    triggerAutosave = vi.fn();
  });

  it('inserts a deep copy of the snapshot as a child of the owning step', () => {
    const command = new RestoreStepHistoryCommand(
      'step-1',
      'entry-snap-root-orig',
      getState,
      setState,
      triggerAutosave,
    );
    command.execute();

    const stepChildren = state.nodes['step-1'].children;
    // step-1 now has the original live-output plus the restored subtree's new root
    expect(stepChildren.length).toBe(2);
  });

  it('mints fresh UUIDs for every node in the restored subtree', () => {
    const command = new RestoreStepHistoryCommand(
      'step-1',
      'entry-snap-root-orig',
      getState,
      setState,
      triggerAutosave,
    );
    command.execute();

    // None of the original snapshot ids may now appear in the live tree.
    expect(state.nodes['snap-root-orig']).toBeUndefined();
    expect(state.nodes['child-a']).toBeUndefined();
    expect(state.nodes['grand-a']).toBeUndefined();
    // But three new nodes were added — by counting net new ids.
    const beforeIds = new Set(['root', 'workflow', 'step-1', 'live-output']);
    const newIds = Object.keys(state.nodes).filter((id) => !beforeIds.has(id));
    expect(newIds.length).toBe(3);
  });

  it('does not collide with any UUID in the live tree', () => {
    const command = new RestoreStepHistoryCommand(
      'step-1',
      'entry-snap-root-orig',
      getState,
      setState,
      triggerAutosave,
    );
    command.execute();
    const ids = Object.keys(state.nodes);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('does not collide with any UUID in any other step history entry', () => {
    state.stepHistory['step-1'] = [
      makeEntry('snap-root-orig', 'step-1', 0),
      makeEntry('snap-root-orig-2', 'step-1', 0),
    ];
    const command = new RestoreStepHistoryCommand(
      'step-1',
      'entry-snap-root-orig',
      getState,
      setState,
      triggerAutosave,
    );
    command.execute();
    const liveIds = new Set(Object.keys(state.nodes));
    for (const entries of Object.values(state.stepHistory)) {
      for (const entry of entries) {
        for (const id of Object.keys(entry.nodes)) {
          expect(liveIds.has(id)).toBe(false);
        }
      }
    }
  });

  it('preserves the current live node — does not replace it', () => {
    const command = new RestoreStepHistoryCommand(
      'step-1',
      'entry-snap-root-orig',
      getState,
      setState,
      triggerAutosave,
    );
    command.execute();
    expect(state.nodes['live-output']).toBeDefined();
    expect(state.nodes['live-output'].content).toBe('live');
  });

  it('does not modify the step history list (non-mutating)', () => {
    const before = JSON.parse(JSON.stringify(state.stepHistory));
    const command = new RestoreStepHistoryCommand(
      'step-1',
      'entry-snap-root-orig',
      getState,
      setState,
      triggerAutosave,
    );
    command.execute();
    expect(state.stepHistory).toEqual(before);
  });

  it('inserting at the recorded position when valid', () => {
    state.stepHistory['step-1'] = [makeEntry('snap-root-orig', 'step-1', 0)];
    state.nodes['step-1'].children = ['live-output', 'another-output'];
    state.nodes['another-output'] = makeNode('another-output', 'another');
    const command = new RestoreStepHistoryCommand(
      'step-1',
      'entry-snap-root-orig',
      getState,
      setState,
      triggerAutosave,
    );
    command.execute();
    // Restored copy lands at position 0 (the recorded slot)
    const stepChildren = state.nodes['step-1'].children;
    expect(stepChildren[0]).not.toBe('live-output');
    expect(stepChildren[0]).not.toBe('another-output');
  });

  it('falls back to last-child position when the recorded position is out of range', () => {
    state.stepHistory['step-1'] = [makeEntry('snap-root-orig', 'step-1', 99)];
    state.nodes['step-1'].children = ['live-output'];
    const command = new RestoreStepHistoryCommand(
      'step-1',
      'entry-snap-root-orig',
      getState,
      setState,
      triggerAutosave,
    );
    expect(() => command.execute()).not.toThrow();
    const stepChildren = state.nodes['step-1'].children;
    expect(stepChildren[stepChildren.length - 1]).not.toBe('live-output');
  });

  it('restoring the same entry twice produces two independent copies with disjoint UUIDs', () => {
    const command1 = new RestoreStepHistoryCommand(
      'step-1',
      'entry-snap-root-orig',
      getState,
      setState,
      triggerAutosave,
    );
    command1.execute();
    const firstRunIds = new Set(
      Object.keys(state.nodes).filter(
        (id) => !['root', 'workflow', 'step-1', 'live-output'].includes(id),
      ),
    );

    const command2 = new RestoreStepHistoryCommand(
      'step-1',
      'entry-snap-root-orig',
      getState,
      setState,
      triggerAutosave,
    );
    command2.execute();
    const secondRunIds = new Set(
      Object.keys(state.nodes).filter(
        (id) =>
          !['root', 'workflow', 'step-1', 'live-output'].includes(id) && !firstRunIds.has(id),
      ),
    );
    expect(firstRunIds.size).toBe(3);
    expect(secondRunIds.size).toBe(3);
    for (const id of secondRunIds) {
      expect(firstRunIds.has(id)).toBe(false);
    }
  });

  it('the restored copy carries no transient bindings from the live node', () => {
    state.nodes['live-output'].metadata = {
      ...state.nodes['live-output'].metadata,
      sessionId: 'session-abc',
    };
    const command = new RestoreStepHistoryCommand(
      'step-1',
      'entry-snap-root-orig',
      getState,
      setState,
      triggerAutosave,
    );
    command.execute();
    const newIds = Object.keys(state.nodes).filter(
      (id) => !['root', 'workflow', 'step-1', 'live-output'].includes(id),
    );
    for (const id of newIds) {
      expect(state.nodes[id].metadata?.sessionId).toBeUndefined();
    }
    // Live node binding is preserved
    expect(state.nodes['live-output'].metadata.sessionId).toBe('session-abc');
  });

  it('undo removes exactly the restored subtree', () => {
    const beforeIds = new Set(Object.keys(state.nodes));
    const command = new RestoreStepHistoryCommand(
      'step-1',
      'entry-snap-root-orig',
      getState,
      setState,
      triggerAutosave,
    );
    command.execute();
    command.undo();
    expect(new Set(Object.keys(state.nodes))).toEqual(beforeIds);
    expect(state.nodes['live-output']).toBeDefined();
  });

  it('exposes touchedNodeIds containing the new root and descendants for undo invalidation', () => {
    const command = new RestoreStepHistoryCommand(
      'step-1',
      'entry-snap-root-orig',
      getState,
      setState,
      triggerAutosave,
    );
    command.execute();
    expect(command.touchedNodeIds).toBeInstanceOf(Set);
    // After execute, the touched ids should include the newly created uuids.
    const newIds = Object.keys(state.nodes).filter(
      (id) => !['root', 'workflow', 'step-1', 'live-output'].includes(id),
    );
    for (const id of newIds) {
      expect(command.touchedNodeIds!.has(id)).toBe(true);
    }
  });

  it('fails silently (no-op) when the entry id does not exist', () => {
    const command = new RestoreStepHistoryCommand(
      'step-1',
      'no-such-entry',
      getState,
      setState,
      triggerAutosave,
    );
    expect(() => command.execute()).not.toThrow();
    // Tree is unchanged
    expect(state.nodes['step-1'].children).toEqual(['live-output']);
  });
});
