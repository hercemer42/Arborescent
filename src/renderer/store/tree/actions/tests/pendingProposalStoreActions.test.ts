import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TreeNode } from '@shared/types';
import { createTreeStore } from '../../treeStore';

function makeNode(id: string, content: string, children: string[] = []): TreeNode {
  return { id, content, children, metadata: {} };
}

function liveTree(): Record<string, TreeNode> {
  return {
    root: makeNode('root', 'Root', ['reviewed', 'other']),
    reviewed: makeNode('reviewed', 'Original reviewed', ['orig-child']),
    'orig-child': makeNode('orig-child', 'Original child', []),
    other: makeNode('other', 'Other node', []),
  };
}

function proposition(): Record<string, TreeNode> {
  return {
    proot: makeNode('proot', 'Proposed reviewed', ['pa', 'pb']),
    pa: makeNode('pa', 'Proposed A', []),
    pb: makeNode('pb', 'Proposed B', []),
  };
}

function makeStore() {
  const store = createTreeStore();
  store.getState().actions.loadDocument(liveTree(), 'root');
  return store;
}

function proposalsOf(store: ReturnType<typeof createTreeStore>) {
  return store.getState().pendingProposals ?? {};
}

describe('pending proposition — treeStore integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe('open / replace / drop', () => {
    it('records a pending proposition under the reviewed node id', () => {
      const store = makeStore();
      store.getState().actions.openPendingProposal('reviewed', 'proot', proposition());
      const entry = proposalsOf(store)['reviewed'];
      expect(entry).toBeDefined();
      expect(entry.reviewedNodeId).toBe('reviewed');
    });

    it('leaves the canonical nodes tree unchanged when opening', () => {
      const store = makeStore();
      const before = store.getState().nodes;
      store.getState().actions.openPendingProposal('reviewed', 'proot', proposition());
      expect(store.getState().nodes).toBe(before);
    });

    it('replaces an existing proposition for the same reviewed node in place', () => {
      const store = makeStore();
      store.getState().actions.openPendingProposal('reviewed', 'proot', proposition());
      const firstId = proposalsOf(store)['reviewed'].id;
      store.getState().actions.openPendingProposal('reviewed', 'proot', proposition());
      expect(Object.keys(proposalsOf(store))).toHaveLength(1);
      expect(proposalsOf(store)['reviewed'].id).not.toBe(firstId);
    });

    it('keeps propositions for different reviewed nodes side by side', () => {
      const store = makeStore();
      store.getState().actions.openPendingProposal('reviewed', 'proot', proposition());
      store.getState().actions.openPendingProposal('other', 'proot', proposition());
      expect(Object.keys(proposalsOf(store)).sort()).toEqual(['other', 'reviewed']);
    });

    it('drops a pending proposition and leaves the canonical nodes tree unchanged', () => {
      const store = makeStore();
      store.getState().actions.openPendingProposal('reviewed', 'proot', proposition());
      const nodesBefore = store.getState().nodes;
      store.getState().actions.dropPendingProposal('reviewed');
      expect(proposalsOf(store)['reviewed']).toBeUndefined();
      expect(store.getState().nodes).toBe(nodesBefore);
    });
  });

  describe('promote (accept)', () => {
    it('promotes the proposition onto the reviewed node id and replaces its subtree', () => {
      const store = makeStore();
      store.getState().actions.openPendingProposal('reviewed', 'proot', proposition());
      store.getState().actions.promotePendingProposal('reviewed');
      const reviewed = store.getState().nodes['reviewed'];
      expect(reviewed).toBeDefined();
      expect(reviewed.content).toBe('Proposed reviewed');
      expect(reviewed.children).toHaveLength(2);
      const childContents = reviewed.children.map((id) => store.getState().nodes[id].content).sort();
      expect(childContents).toEqual(['Proposed A', 'Proposed B']);
      const allContents = Object.values(store.getState().nodes).map((node) => node.content);
      expect(allContents).not.toContain('Original child');
    });

    it('re-ids proposition descendants to fresh ids distinct from the snapshot ids', () => {
      const store = makeStore();
      store.getState().actions.openPendingProposal('reviewed', 'proot', proposition());
      const snapshotIds = new Set(Object.keys(proposalsOf(store)['reviewed'].nodes));
      store.getState().actions.promotePendingProposal('reviewed');
      const reviewed = store.getState().nodes['reviewed'];
      for (const childId of reviewed.children) {
        expect(snapshotIds.has(childId)).toBe(false);
        expect(store.getState().nodes[childId]).toBeDefined();
      }
    });

    it('drops the pending entry once promoted', () => {
      const store = makeStore();
      store.getState().actions.openPendingProposal('reviewed', 'proot', proposition());
      store.getState().actions.promotePendingProposal('reviewed');
      expect(proposalsOf(store)['reviewed']).toBeUndefined();
    });

    it('is undoable: undo restores the pre-promote subtree', () => {
      const store = makeStore();
      store.getState().actions.openPendingProposal('reviewed', 'proot', proposition());
      store.getState().actions.promotePendingProposal('reviewed');
      expect(store.getState().nodes['reviewed'].content).toBe('Proposed reviewed');

      const undone = store.getState().actions.undo();
      expect(undone).toBe(true);
      const reviewed = store.getState().nodes['reviewed'];
      expect(reviewed.content).toBe('Original reviewed');
      expect(reviewed.children).toEqual(['orig-child']);
      expect(store.getState().nodes['orig-child']).toBeDefined();
    });
  });

  describe('error and boundary', () => {
    it('promoting with no pending proposition is a handled no-op', () => {
      const store = makeStore();
      const before = store.getState().nodes;
      expect(() => store.getState().actions.promotePendingProposal('reviewed')).not.toThrow();
      expect(store.getState().nodes).toBe(before);
    });

    it('promoting a proposition with no root snapshot is a no-op and does not corrupt the reviewed subtree', () => {
      const store = makeStore();
      // A proposition whose root id is absent from its nodes yields an empty snapshot.
      store.getState().actions.openPendingProposal('reviewed', 'absent-root', { other: makeNode('other', 'x') });
      const before = store.getState().nodes;

      expect(() => store.getState().actions.promotePendingProposal('reviewed')).not.toThrow();

      expect(store.getState().nodes).toBe(before);
      expect(store.getState().nodes['reviewed'].children).toEqual(['orig-child']);
      expect(store.getState().nodes['orig-child']).toBeDefined();
    });

    it('promoting a proposition whose reviewed node was deleted is handled and leaves other propositions intact', () => {
      const store = makeStore();
      store.getState().actions.openPendingProposal('reviewed', 'proot', proposition());
      store.getState().actions.openPendingProposal('other', 'proot', proposition());

      const nodesWithoutReviewed = { ...store.getState().nodes };
      delete nodesWithoutReviewed['reviewed'];
      delete nodesWithoutReviewed['orig-child'];
      store.setState({ nodes: nodesWithoutReviewed });

      expect(() => store.getState().actions.promotePendingProposal('reviewed')).not.toThrow();
      expect(proposalsOf(store)['other']).toBeDefined();
    });
  });
});
