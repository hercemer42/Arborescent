import { describe, it, expect } from 'vitest';
import type { TreeNode } from '@shared/types';
import {
  StepHistoryEntry,
  appendStepHistoryEntry,
  captureStepHistoryEntry,
  STEP_HISTORY_MAX_ENTRIES,
} from '../stepHistory';

function makeNode(id: string, content: string, children: string[] = []): TreeNode {
  return { id, content, children, metadata: {} };
}

function makeEntry(rootId: string, parentLabel = 'parent'): StepHistoryEntry {
  return {
    id: `entry-${rootId}`,
    capturedAt: '2026-01-01T00:00:00.000Z',
    parentLabel,
    rootNodeId: rootId,
    nodes: { [rootId]: makeNode(rootId, 'root', []) },
    position: 0,
  };
}

describe('stepHistory ring buffer', () => {
  describe('appendStepHistoryEntry', () => {
    it('appends a new entry to an empty history', () => {
      const entry = makeEntry('a');
      const result = appendStepHistoryEntry([], entry);
      expect(result).toEqual([entry]);
    });

    it('preserves time order (newest at end)', () => {
      const e1 = makeEntry('a');
      const e2 = makeEntry('b');
      const e3 = makeEntry('c');
      let history: StepHistoryEntry[] = [];
      history = appendStepHistoryEntry(history, e1);
      history = appendStepHistoryEntry(history, e2);
      history = appendStepHistoryEntry(history, e3);
      expect(history.map((e) => e.rootNodeId)).toEqual(['a', 'b', 'c']);
    });

    it('caps the history at STEP_HISTORY_MAX_ENTRIES entries', () => {
      let history: StepHistoryEntry[] = [];
      for (let i = 0; i < STEP_HISTORY_MAX_ENTRIES + 5; i++) {
        history = appendStepHistoryEntry(history, makeEntry(`e-${i}`));
      }
      expect(history).toHaveLength(STEP_HISTORY_MAX_ENTRIES);
    });

    it('drops the oldest entry first when the cap is reached (FIFO eviction)', () => {
      let history: StepHistoryEntry[] = [];
      for (let i = 0; i < STEP_HISTORY_MAX_ENTRIES; i++) {
        history = appendStepHistoryEntry(history, makeEntry(`e-${i}`));
      }
      // 11th entry should evict e-0
      history = appendStepHistoryEntry(history, makeEntry('e-new'));
      expect(history).toHaveLength(STEP_HISTORY_MAX_ENTRIES);
      expect(history.some((e) => e.rootNodeId === 'e-0')).toBe(false);
      expect(history[history.length - 1].rootNodeId).toBe('e-new');
    });

    it('exposes a default cap of 10 entries', () => {
      expect(STEP_HISTORY_MAX_ENTRIES).toBe(10);
    });

    it('returns a new array (immutability)', () => {
      const initial: StepHistoryEntry[] = [makeEntry('a')];
      const result = appendStepHistoryEntry(initial, makeEntry('b'));
      expect(result).not.toBe(initial);
      expect(initial).toHaveLength(1);
    });
  });

  describe('captureStepHistoryEntry', () => {
    it('captures the full descendant subtree of a node into the entry', () => {
      const nodes: Record<string, TreeNode> = {
        root: makeNode('root', 'root', ['a']),
        a: makeNode('a', 'A', ['b', 'c']),
        b: makeNode('b', 'B', []),
        c: makeNode('c', 'C', []),
      };
      const entry = captureStepHistoryEntry('a', nodes, 'root', 0);
      expect(Object.keys(entry.nodes)).toHaveLength(3);
      expect(entry.nodes[entry.rootNodeId]).toBeDefined();
    });

    // parentLabel must hold the historized node's own title (the subtree rooted at
    // rootNodeId), not the owning workflow step that is its immediate parent.
    it('labels the entry with the historized node title, not the parent step title', () => {
      const nodes: Record<string, TreeNode> = {
        parent: makeNode('parent', 'Owning workflow step title', ['a']),
        a: makeNode('a', 'Historized node title', []),
      };
      const entry = captureStepHistoryEntry('a', nodes, 'parent', 0);
      expect(entry.parentLabel).toContain('Historized node title');
      expect(entry.parentLabel).not.toContain('Owning workflow step title');
    });

    it('distinguishes successive captures of different nodes under the same step', () => {
      const nodes: Record<string, TreeNode> = {
        step: makeNode('step', 'Bug creation', ['first', 'second']),
        first: makeNode('first', 'First content node', []),
        second: makeNode('second', 'Second content node', []),
      };
      const e1 = captureStepHistoryEntry('first', nodes, 'step', 0);
      const e2 = captureStepHistoryEntry('second', nodes, 'step', 1);
      expect(e1.parentLabel).not.toBe(e2.parentLabel);
      expect(e1.parentLabel).toContain('First content node');
      expect(e2.parentLabel).toContain('Second content node');
    });

    it('truncates a long historized node title to the max label length', () => {
      const longTitle = 'x'.repeat(200);
      const nodes: Record<string, TreeNode> = {
        parent: makeNode('parent', 'short step', ['a']),
        a: makeNode('a', longTitle, []),
      };
      const entry = captureStepHistoryEntry('a', nodes, 'parent', 0);
      expect(entry.parentLabel.length).toBeLessThanOrEqual(120);
      expect(entry.parentLabel.endsWith('…')).toBe(true);
    });

    it('does not throw when the historized node content is empty', () => {
      const nodes: Record<string, TreeNode> = {
        parent: makeNode('parent', 'step', ['a']),
        a: makeNode('a', '', []),
      };
      const entry = captureStepHistoryEntry('a', nodes, 'parent', 0);
      expect(typeof entry.parentLabel).toBe('string');
    });

    it('does not throw when the historized node is missing from the map', () => {
      const nodes: Record<string, TreeNode> = {
        parent: makeNode('parent', 'step', []),
      };
      expect(() => captureStepHistoryEntry('missing', nodes, 'parent', 0)).not.toThrow();
    });

    // The exact placeholder string for an empty/missing title is an open product decision.
    it.todo('falls back to a non-empty placeholder label when the historized node title is empty');

    it('records the current position of the captured node within its parent', () => {
      const nodes: Record<string, TreeNode> = {
        parent: makeNode('parent', 'p', ['a', 'b', 'c']),
        a: makeNode('a', 'A', []),
        b: makeNode('b', 'B', []),
        c: makeNode('c', 'C', []),
      };
      const entry = captureStepHistoryEntry('b', nodes, 'parent', 1);
      expect(entry.position).toBe(1);
    });

    it('stamps a capturedAt ISO timestamp', () => {
      const nodes: Record<string, TreeNode> = {
        parent: makeNode('parent', 'p', ['a']),
        a: makeNode('a', 'A', []),
      };
      const entry = captureStepHistoryEntry('a', nodes, 'parent', 0);
      expect(typeof entry.capturedAt).toBe('string');
      expect(new Date(entry.capturedAt).toString()).not.toBe('Invalid Date');
    });

    it('produces a unique entry id per capture even for the same node', () => {
      const nodes: Record<string, TreeNode> = {
        parent: makeNode('parent', 'p', ['a']),
        a: makeNode('a', 'A', []),
      };
      const e1 = captureStepHistoryEntry('a', nodes, 'parent', 0);
      const e2 = captureStepHistoryEntry('a', nodes, 'parent', 0);
      expect(e1.id).not.toBe(e2.id);
    });

    it('captures node content faithfully (deep copy)', () => {
      const nodes: Record<string, TreeNode> = {
        parent: makeNode('parent', 'p', ['a']),
        a: makeNode('a', 'original', []),
      };
      const entry = captureStepHistoryEntry('a', nodes, 'parent', 0);
      // Mutate live node afterward — captured entry should not change
      nodes.a.content = 'mutated';
      expect(entry.nodes[entry.rootNodeId].content).toBe('original');
    });

    it('mints fresh UUIDs for every node in the captured subtree (no overlap with source)', () => {
      const nodes: Record<string, TreeNode> = {
        root: makeNode('root', 'root', ['a']),
        a: makeNode('a', 'A', ['b']),
        b: makeNode('b', 'B', []),
      };
      const entry = captureStepHistoryEntry('a', nodes, 'root', 0);
      const sourceIds = new Set(Object.keys(nodes));
      for (const id of Object.keys(entry.nodes)) {
        expect(sourceIds.has(id)).toBe(false);
      }
    });

    it('rootNodeId references a key that exists in entry.nodes', () => {
      const nodes: Record<string, TreeNode> = {
        parent: makeNode('parent', 'p', ['a']),
        a: makeNode('a', 'A', ['b']),
        b: makeNode('b', 'B', []),
      };
      const entry = captureStepHistoryEntry('a', nodes, 'parent', 0);
      expect(entry.nodes[entry.rootNodeId]).toBeDefined();
    });

    it('child references inside captured entry.nodes use the remapped IDs not the originals', () => {
      const nodes: Record<string, TreeNode> = {
        parent: makeNode('parent', 'p', ['a']),
        a: makeNode('a', 'A', ['b', 'c']),
        b: makeNode('b', 'B', []),
        c: makeNode('c', 'C', []),
      };
      const entry = captureStepHistoryEntry('a', nodes, 'parent', 0);
      const root = entry.nodes[entry.rootNodeId];
      for (const childId of root.children) {
        expect(childId).not.toBe('b');
        expect(childId).not.toBe('c');
        expect(entry.nodes[childId]).toBeDefined();
      }
    });

    it('every node id in entry.nodes also matches the id field on its TreeNode', () => {
      const nodes: Record<string, TreeNode> = {
        parent: makeNode('parent', 'p', ['a']),
        a: makeNode('a', 'A', ['b']),
        b: makeNode('b', 'B', []),
      };
      const entry = captureStepHistoryEntry('a', nodes, 'parent', 0);
      for (const [id, node] of Object.entries(entry.nodes)) {
        expect(node.id).toBe(id);
      }
    });

    it('produces distinct UUIDs across two captures of the same source subtree (no entry-to-entry collision)', () => {
      const nodes: Record<string, TreeNode> = {
        parent: makeNode('parent', 'p', ['a']),
        a: makeNode('a', 'A', ['b']),
        b: makeNode('b', 'B', []),
      };
      const e1 = captureStepHistoryEntry('a', nodes, 'parent', 0);
      const e2 = captureStepHistoryEntry('a', nodes, 'parent', 0);
      const e1Ids = new Set(Object.keys(e1.nodes));
      for (const id of Object.keys(e2.nodes)) {
        expect(e1Ids.has(id)).toBe(false);
      }
    });
  });
});
