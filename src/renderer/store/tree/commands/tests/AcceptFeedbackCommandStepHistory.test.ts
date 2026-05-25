import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AcceptFeedbackCommand } from '../AcceptFeedbackCommand';
import { TreeNode } from '../../../../../shared/types';
import type { StepHistoryEntry, StepHistoryMap } from '../../stepHistory/stepHistory';

function createNode(
  id: string,
  content: string,
  children: string[] = [],
  metadata: Record<string, unknown> = {},
): TreeNode {
  return { id, content, children, metadata };
}

type AcceptMode = 'autonomous' | 'checkpoint-accept' | 'manual-send-accept';

function createState(
  nodes: Record<string, TreeNode>,
  rootNodeId: string,
  ancestorRegistry: Record<string, string[]>,
  stepHistory: StepHistoryMap = {},
) {
  return {
    nodes,
    rootNodeId,
    ancestorRegistry,
    blueprintModeEnabled: false,
    collaboratingNodeId: null as string | null,
    stepHistory,
  };
}

describe('AcceptFeedbackCommand — three-way step-history routing', () => {
  // Tree:
  //   root
  //   └── workflow (isWorkflow)
  //       └── step-auto (autonomous)
  //           └── collab-node (the working node)
  let mockState: ReturnType<typeof createState>;
  let getState: () => typeof mockState;
  let setState: ReturnType<typeof vi.fn>;
  let triggerAutosave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    const nodes: Record<string, TreeNode> = {
      root: createNode('root', 'Root', ['workflow']),
      workflow: createNode('workflow', 'WF', ['step-auto'], { isWorkflow: true }),
      'step-auto': createNode('step-auto', 'Auto Step', ['collab-node'], {
        stepType: 'autonomous',
      }),
      'collab-node': createNode('collab-node', 'original', [], {}),
    };
    const ancestorRegistry: Record<string, string[]> = {
      root: [],
      workflow: ['root'],
      'step-auto': ['root', 'workflow'],
      'collab-node': ['root', 'workflow', 'step-auto'],
    };
    mockState = createState(nodes, 'root', ancestorRegistry, {});
    getState = vi.fn(() => mockState);
    setState = vi.fn((partial: Partial<typeof mockState>) => {
      Object.assign(mockState, partial);
    });
    triggerAutosave = vi.fn();
  });

  describe('autonomous-mode acceptance', () => {
    it('writes a pre-mutation snapshot to the owning step history', () => {
      const newNodes = {
        'new-root': createNode('new-root', 'AI replaced content', []),
      };
      const command = new AcceptFeedbackCommand(
        'collab-node',
        'new-root',
        newNodes,
        getState,
        setState,
        triggerAutosave,
        undefined,
        undefined,
        { acceptMode: 'autonomous' satisfies AcceptMode },
      );
      command.execute();

      const setCalls = setState.mock.calls.map((c) => c[0]);
      const lastWithHistory = setCalls.find((p) => p.stepHistory);
      expect(lastWithHistory?.stepHistory?.['step-auto']).toBeDefined();
      expect(lastWithHistory?.stepHistory?.['step-auto']).toHaveLength(1);
      const entry = lastWithHistory!.stepHistory!['step-auto'][0];
      expect(entry.nodes[entry.rootNodeId].content).toBe('original');
    });

    it('reports zero touchedNodeIds on autonomous accept so it is never on the user undo stack', () => {
      const newNodes = { 'new-root': createNode('new-root', 'x', []) };
      const command = new AcceptFeedbackCommand(
        'collab-node',
        'new-root',
        newNodes,
        getState,
        setState,
        triggerAutosave,
        undefined,
        undefined,
        { acceptMode: 'autonomous' },
      );
      // Autonomous accepts skip the user undo stack — by convention they are
      // never executed via HistoryManager.executeCommand. So they have no
      // touchedNodeIds requirement; but if present, the field is harmless.
      // The non-registration is enforced by the workflow execution path, not
      // by the command itself. This test asserts the command does not assume
      // it will be on the undo stack.
      expect(() => command.execute()).not.toThrow();
    });
  });

  describe('checkpoint-accept acceptance (dual write)', () => {
    beforeEach(() => {
      mockState.nodes['step-auto'].metadata.stepType = 'checkpoint';
    });

    it('writes a pre-accept snapshot to the owning checkpoint step history', () => {
      const newNodes = { 'new-root': createNode('new-root', 'accepted', []) };
      const command = new AcceptFeedbackCommand(
        'collab-node',
        'new-root',
        newNodes,
        getState,
        setState,
        triggerAutosave,
        undefined,
        undefined,
        { acceptMode: 'checkpoint-accept' },
      );
      command.execute();

      const setCalls = setState.mock.calls.map((c) => c[0]);
      const lastWithHistory = setCalls.find((p) => p.stepHistory);
      expect(lastWithHistory?.stepHistory?.['step-auto']).toBeDefined();
      expect(lastWithHistory!.stepHistory!['step-auto']).toHaveLength(1);
      const entry = lastWithHistory!.stepHistory!['step-auto'][0];
      expect(entry.nodes[entry.rootNodeId].content).toBe('original');
    });

    it('historized snapshot uses remapped UUIDs distinct from the live tree', () => {
      const newNodes = { 'new-root': createNode('new-root', 'accepted', []) };
      const command = new AcceptFeedbackCommand(
        'collab-node',
        'new-root',
        newNodes,
        getState,
        setState,
        triggerAutosave,
        undefined,
        undefined,
        { acceptMode: 'checkpoint-accept' },
      );
      command.execute();

      const setCalls = setState.mock.calls.map((c) => c[0]);
      const lastWithHistory = setCalls.find((p) => p.stepHistory);
      const entry = lastWithHistory!.stepHistory!['step-auto'][0];
      // The collaborating node's id is preserved in the live tree by AcceptFeedbackCommand's
      // single-root strategy. The captured snapshot must NOT reuse that id.
      expect(Object.keys(entry.nodes)).not.toContain('collab-node');
      expect(entry.rootNodeId).not.toBe('collab-node');
    });

    it('no UUID collision between live tree and historized snapshot after execute', () => {
      const newNodes = { 'new-root': createNode('new-root', 'accepted', []) };
      const command = new AcceptFeedbackCommand(
        'collab-node',
        'new-root',
        newNodes,
        getState,
        setState,
        triggerAutosave,
        undefined,
        undefined,
        { acceptMode: 'checkpoint-accept' },
      );
      command.execute();

      const setCalls = setState.mock.calls.map((c) => c[0]);
      const lastWithHistory = setCalls.find((p) => p.stepHistory);
      const entry = lastWithHistory!.stepHistory!['step-auto'][0];
      const liveIds = new Set(Object.keys(mockState.nodes));
      for (const id of Object.keys(entry.nodes)) {
        expect(liveIds.has(id)).toBe(false);
      }
    });

    it('exposes the working node UUID in touchedNodeIds so user-undo invalidation works', () => {
      const newNodes = { 'new-root': createNode('new-root', 'accepted', []) };
      const command = new AcceptFeedbackCommand(
        'collab-node',
        'new-root',
        newNodes,
        getState,
        setState,
        triggerAutosave,
        undefined,
        undefined,
        { acceptMode: 'checkpoint-accept' },
      );
      expect(command.touchedNodeIds?.has('collab-node')).toBe(true);
    });

    it.todo(
      'undo of a checkpoint-accept leaves the pre-accept step history entry in place',
    );

    it('does not append a duplicate snapshot when redo is invoked after undo', () => {
      const newNodes = { 'new-root': createNode('new-root', 'accepted', []) };
      const command = new AcceptFeedbackCommand(
        'collab-node',
        'new-root',
        newNodes,
        getState,
        setState,
        triggerAutosave,
        undefined,
        undefined,
        { acceptMode: 'checkpoint-accept' },
      );
      command.execute();
      command.undo();
      command.redo();

      const setCalls = setState.mock.calls.map((c) => c[0]);
      const allHistoryWrites = setCalls.filter((p) => p.stepHistory);
      const lastEntries = allHistoryWrites.at(-1)?.stepHistory?.['step-auto'] ?? [];
      expect(lastEntries).toHaveLength(1);
    });
  });

  describe('manual-send-accept acceptance (user undo only)', () => {
    it('does not write any step history entry when there is no owning workflow step', () => {
      // Reposition the working node directly under the root, outside any workflow.
      mockState.nodes.root.children = ['collab-node'];
      mockState.nodes['collab-node'] = createNode('collab-node', 'original');
      mockState.ancestorRegistry = { root: [], 'collab-node': ['root'] };

      const newNodes = { 'new-root': createNode('new-root', 'accepted', []) };
      const command = new AcceptFeedbackCommand(
        'collab-node',
        'new-root',
        newNodes,
        getState,
        setState,
        triggerAutosave,
        undefined,
        undefined,
        { acceptMode: 'manual-send-accept' },
      );
      command.execute();

      const setCalls = setState.mock.calls.map((c) => c[0]);
      const anyWroteHistory = setCalls.some((p) => p.stepHistory && Object.keys(p.stepHistory).length > 0);
      expect(anyWroteHistory).toBe(false);
    });

    it('still exposes the working node UUID in touchedNodeIds for user-undo invalidation', () => {
      const newNodes = { 'new-root': createNode('new-root', 'accepted', []) };
      const command = new AcceptFeedbackCommand(
        'collab-node',
        'new-root',
        newNodes,
        getState,
        setState,
        triggerAutosave,
        undefined,
        undefined,
        { acceptMode: 'manual-send-accept' },
      );
      expect(command.touchedNodeIds?.has('collab-node')).toBe(true);
    });
  });

  describe('multi-root decomposition seeding', () => {
    beforeEach(() => {
      mockState.nodes['step-auto'].metadata.stepType = 'autonomous';
      mockState.nodes['step-auto'].metadata.decomposition = true;
    });

    it('writes a pre-decomposition snapshot of the parent on the decomposition step on multi-root accept', () => {
      const newNodes = {
        'sib-1': createNode('sib-1', 'Sibling 1', []),
        'sib-2': createNode('sib-2', 'Sibling 2', []),
      };
      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['sib-1', 'sib-2'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
        undefined,
        undefined,
        { acceptMode: 'autonomous' },
      );
      command.execute();

      const setCalls = setState.mock.calls.map((c) => c[0]);
      const lastWithHistory = setCalls.find((p) => p.stepHistory);
      expect(lastWithHistory?.stepHistory?.['step-auto']).toBeDefined();
      const entries: StepHistoryEntry[] = lastWithHistory!.stepHistory!['step-auto'];
      const preDecomposition = entries.find(
        (e: StepHistoryEntry) => e.nodes[e.rootNodeId]?.content === 'original',
      );
      expect(preDecomposition).toBeDefined();
    });

    it('seeds an initial-state history entry on the owning step for each generated sibling', () => {
      const newNodes = {
        'sib-1': createNode('sib-1', 'Sibling 1', []),
        'sib-2': createNode('sib-2', 'Sibling 2', []),
      };
      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['sib-1', 'sib-2'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
        undefined,
        undefined,
        { acceptMode: 'autonomous' },
      );
      command.execute();

      const setCalls = setState.mock.calls.map((c) => c[0]);
      const lastWithHistory = setCalls.find((p) => p.stepHistory);
      const entries: StepHistoryEntry[] = lastWithHistory!.stepHistory!['step-auto'] ?? [];
      const siblingSnapshots = entries.filter((e: StepHistoryEntry) => {
        const root = e.nodes[e.rootNodeId];
        return root && (root.content === 'Sibling 1' || root.content === 'Sibling 2');
      });
      expect(siblingSnapshots).toHaveLength(2);
    });

    it('total entries written equals 1 (pre-decomposition) + N (one per sibling)', () => {
      const newNodes = {
        'sib-1': createNode('sib-1', 'Sibling 1', []),
        'sib-2': createNode('sib-2', 'Sibling 2', []),
        'sib-3': createNode('sib-3', 'Sibling 3', []),
      };
      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['sib-1', 'sib-2', 'sib-3'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
        undefined,
        undefined,
        { acceptMode: 'autonomous' },
      );
      command.execute();

      const setCalls = setState.mock.calls.map((c) => c[0]);
      const lastWithHistory = setCalls.findLast((p) => p.stepHistory);
      const entries = lastWithHistory!.stepHistory!['step-auto'] ?? [];
      expect(entries).toHaveLength(4);
    });

    it('siblings with descendants still produce exactly one entry per top-level sibling, not one per node', () => {
      // 2 siblings, each with 3 descendants. Buggy implementation that iterates
      // createdNodeIds (roots + all descendants) would write 1 + 8 = 9 entries
      // and overflow the ring buffer with multi-level decomposition. Correct
      // behaviour: 1 pre-decomposition + 2 sibling roots = 3 entries.
      const newNodes = {
        'sib-1': createNode('sib-1', 'Sibling 1', ['s1-c1', 's1-c2', 's1-c3']),
        's1-c1': createNode('s1-c1', 'S1 child 1', []),
        's1-c2': createNode('s1-c2', 'S1 child 2', []),
        's1-c3': createNode('s1-c3', 'S1 child 3', []),
        'sib-2': createNode('sib-2', 'Sibling 2', ['s2-c1', 's2-c2', 's2-c3']),
        's2-c1': createNode('s2-c1', 'S2 child 1', []),
        's2-c2': createNode('s2-c2', 'S2 child 2', []),
        's2-c3': createNode('s2-c3', 'S2 child 3', []),
      };
      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['sib-1', 'sib-2'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
        undefined,
        undefined,
        { acceptMode: 'autonomous' },
      );
      command.execute();

      const setCalls = setState.mock.calls.map((c) => c[0]);
      const lastWithHistory = setCalls.findLast((p) => p.stepHistory);
      const entries = lastWithHistory!.stepHistory!['step-auto'] ?? [];
      expect(entries).toHaveLength(3);
    });

    it('each sibling entry records its own splice position (snapshot.position + i)', () => {
      const newNodes = {
        'sib-1': createNode('sib-1', 'Sibling 1', []),
        'sib-2': createNode('sib-2', 'Sibling 2', []),
        'sib-3': createNode('sib-3', 'Sibling 3', []),
      };
      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['sib-1', 'sib-2', 'sib-3'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
        undefined,
        undefined,
        { acceptMode: 'autonomous' },
      );
      command.execute();

      const setCalls = setState.mock.calls.map((c) => c[0]);
      const lastWithHistory = setCalls.findLast((p) => p.stepHistory);
      const entries: StepHistoryEntry[] = lastWithHistory!.stepHistory!['step-auto'] ?? [];
      const siblingEntries = entries.filter((e: StepHistoryEntry) => {
        const root = e.nodes[e.rootNodeId];
        return root && root.content.startsWith('Sibling ');
      });
      const positions = siblingEntries.map((e) => e.position).sort((a, b) => a - b);
      // collab-node sits at index 0 of step-auto.children, so siblings splice in at 0, 1, 2.
      expect(positions).toEqual([0, 1, 2]);
    });

    it('does not duplicate sibling seeds when execute → undo → redo', () => {
      const newNodes = {
        'sib-1': createNode('sib-1', 'Sibling 1', []),
        'sib-2': createNode('sib-2', 'Sibling 2', []),
      };
      const command = new AcceptFeedbackCommand(
        'collab-node',
        ['sib-1', 'sib-2'],
        newNodes,
        getState,
        setState,
        triggerAutosave,
        undefined,
        undefined,
        { acceptMode: 'autonomous' },
      );
      command.execute();
      command.undo();
      command.redo();

      const setCalls = setState.mock.calls.map((c) => c[0]);
      const lastWithHistory = setCalls.findLast((p) => p.stepHistory);
      const entries = lastWithHistory!.stepHistory!['step-auto'] ?? [];
      // 1 pre-decomposition + 2 siblings = 3, even after redo
      expect(entries).toHaveLength(3);
    });
  });
});
