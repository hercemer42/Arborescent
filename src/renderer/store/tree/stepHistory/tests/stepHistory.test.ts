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
      expect(entry.rootNodeId).toBe('a');
      expect(Object.keys(entry.nodes).sort()).toEqual(['a', 'b', 'c']);
    });

    it('records the parent label at capture time', () => {
      const nodes: Record<string, TreeNode> = {
        parent: makeNode('parent', 'A long parent content', ['a']),
        a: makeNode('a', 'A', []),
      };
      const entry = captureStepHistoryEntry('a', nodes, 'parent', 0);
      expect(entry.parentLabel).toContain('A long parent content');
    });

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
  });
});
