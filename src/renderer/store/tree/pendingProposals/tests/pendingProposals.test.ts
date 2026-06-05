import { describe, it, expect } from 'vitest';
import type { TreeNode } from '@shared/types';
import {
  type PendingProposalEntry,
  type PendingProposalMap,
  capturePendingProposal,
  setPendingProposal,
  dropPendingProposal,
} from '../pendingProposals';

function makeNode(id: string, content: string, children: string[] = []): TreeNode {
  return { id, content, children, metadata: {} };
}

// A small proposition subtree, ids deliberately overlapping common live ids so the
// remap behaviour is observable.
function propositionNodes(): Record<string, TreeNode> {
  return {
    root: makeNode('root', 'proposed root', ['a', 'b']),
    a: makeNode('a', 'proposed A', []),
    b: makeNode('b', 'proposed B', ['c']),
    c: makeNode('c', 'proposed C', []),
  };
}

describe('pendingProposals', () => {
  describe('capturePendingProposal', () => {
    it('captures the full proposition subtree into the entry', () => {
      const entry = capturePendingProposal('reviewed-1', 'root', propositionNodes());
      expect(Object.keys(entry.nodes)).toHaveLength(4);
      expect(entry.nodes[entry.rootNodeId]).toBeDefined();
    });

    it('records the reviewed node id the proposition targets', () => {
      const entry = capturePendingProposal('reviewed-1', 'root', propositionNodes());
      expect(entry.reviewedNodeId).toBe('reviewed-1');
    });

    it('mints fresh ids for every node in the snapshot (no overlap with the source ids)', () => {
      const source = propositionNodes();
      const entry = capturePendingProposal('reviewed-1', 'root', source);
      const sourceIds = new Set(Object.keys(source));
      for (const id of Object.keys(entry.nodes)) {
        expect(sourceIds.has(id)).toBe(false);
      }
    });

    it('does not reuse the reviewed node id for the snapshot root (no collision with the live node)', () => {
      const entry = capturePendingProposal('reviewed-1', 'root', propositionNodes());
      expect(entry.rootNodeId).not.toBe('reviewed-1');
    });

    it('rootNodeId references a key that exists in entry.nodes', () => {
      const entry = capturePendingProposal('reviewed-1', 'root', propositionNodes());
      expect(entry.nodes[entry.rootNodeId]).toBeDefined();
    });

    it('child references inside the snapshot use the remapped ids, not the originals', () => {
      const entry = capturePendingProposal('reviewed-1', 'root', propositionNodes());
      const root = entry.nodes[entry.rootNodeId];
      for (const childId of root.children) {
        expect(childId).not.toBe('a');
        expect(childId).not.toBe('b');
        expect(entry.nodes[childId]).toBeDefined();
      }
    });

    it('every node id in entry.nodes matches the id field on its TreeNode', () => {
      const entry = capturePendingProposal('reviewed-1', 'root', propositionNodes());
      for (const [id, node] of Object.entries(entry.nodes)) {
        expect(node.id).toBe(id);
      }
    });

    it('deep-copies content so later mutation of the source does not change the snapshot', () => {
      const source = propositionNodes();
      const entry = capturePendingProposal('reviewed-1', 'root', source);
      source.root.content = 'mutated';
      expect(entry.nodes[entry.rootNodeId].content).toBe('proposed root');
    });

    it('produces a unique entry id per capture', () => {
      const e1 = capturePendingProposal('reviewed-1', 'root', propositionNodes());
      const e2 = capturePendingProposal('reviewed-1', 'root', propositionNodes());
      expect(e1.id).not.toBe(e2.id);
    });

    it('mints distinct ids across two captures of the same source (no entry-to-entry collision)', () => {
      const source = propositionNodes();
      const e1 = capturePendingProposal('reviewed-1', 'root', source);
      const e2 = capturePendingProposal('reviewed-1', 'root', source);
      const e1Ids = new Set(Object.keys(e1.nodes));
      for (const id of Object.keys(e2.nodes)) {
        expect(e1Ids.has(id)).toBe(false);
      }
    });

    it('stamps a capturedAt ISO timestamp', () => {
      const entry = capturePendingProposal('reviewed-1', 'root', propositionNodes());
      expect(new Date(entry.capturedAt).toString()).not.toBe('Invalid Date');
    });

    it('does not throw when the proposition root is missing from the node map', () => {
      expect(() => capturePendingProposal('reviewed-1', 'missing', { other: makeNode('other', 'x') })).not.toThrow();
    });
  });

  describe('setPendingProposal', () => {
    function entryFor(reviewedNodeId: string, rootContent = 'proposed root'): PendingProposalEntry {
      const e = capturePendingProposal(reviewedNodeId, 'root', propositionNodes());
      e.nodes[e.rootNodeId].content = rootContent;
      return e;
    }

    it('records the entry under its reviewed node id', () => {
      const entry = entryFor('reviewed-1');
      const map = setPendingProposal({}, entry);
      expect(map['reviewed-1']).toBe(entry);
    });

    it('returns a new map and does not mutate the input', () => {
      const initial: PendingProposalMap = {};
      const result = setPendingProposal(initial, entryFor('reviewed-1'));
      expect(result).not.toBe(initial);
      expect(Object.keys(initial)).toHaveLength(0);
    });

    it('replaces the proposition in place when one already exists for the reviewed node (no duplicate)', () => {
      const first = entryFor('reviewed-1', 'first');
      const second = entryFor('reviewed-1', 'second');
      let map = setPendingProposal({}, first);
      map = setPendingProposal(map, second);
      expect(Object.keys(map)).toHaveLength(1);
      expect(map['reviewed-1']).toBe(second);
    });

    it('keeps propositions for other reviewed nodes intact (concurrent reviews coexist)', () => {
      let map = setPendingProposal({}, entryFor('reviewed-1'));
      map = setPendingProposal(map, entryFor('reviewed-2'));
      expect(Object.keys(map).sort()).toEqual(['reviewed-1', 'reviewed-2']);
    });
  });

  describe('dropPendingProposal', () => {
    function seed(): PendingProposalMap {
      let map = setPendingProposal({}, capturePendingProposal('reviewed-1', 'root', propositionNodes()));
      map = setPendingProposal(map, capturePendingProposal('reviewed-2', 'root', propositionNodes()));
      return map;
    }

    it('removes the entry for the given reviewed node id', () => {
      const map = dropPendingProposal(seed(), 'reviewed-1');
      expect(map['reviewed-1']).toBeUndefined();
    });

    it('returns a new map and does not mutate the input', () => {
      const initial = seed();
      const result = dropPendingProposal(initial, 'reviewed-1');
      expect(result).not.toBe(initial);
      expect(initial['reviewed-1']).toBeDefined();
    });

    it('leaves the other reviewed nodes propositions intact', () => {
      const map = dropPendingProposal(seed(), 'reviewed-1');
      expect(map['reviewed-2']).toBeDefined();
    });

    it('is a no-op when the reviewed node has no pending proposition', () => {
      const before = seed();
      const after = dropPendingProposal(before, 'reviewed-absent');
      expect(Object.keys(after).sort()).toEqual(['reviewed-1', 'reviewed-2']);
    });
  });
});
