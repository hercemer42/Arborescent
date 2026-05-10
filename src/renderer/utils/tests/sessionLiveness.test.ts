import { describe, it, expect } from 'vitest';
import { getSessionLiveness } from '../sessionLiveness';
import type { TreeNode } from '@shared/types';

function makeNode(metadata: Record<string, unknown> = {}): TreeNode {
  return { id: 'n', content: '', children: [], metadata };
}

describe('getSessionLiveness', () => {
  describe('no-session — node has no sessionId', () => {
    it('returns no-session when sessionId is undefined', () => {
      expect(getSessionLiveness(makeNode(), {})).toBe('no-session');
    });

    it('returns no-session when sessionId is an empty string', () => {
      expect(getSessionLiveness(makeNode({ sessionId: '' }), {})).toBe('no-session');
    });

    it('returns no-session regardless of workflowSessionMap content when sessionId is absent', () => {
      const map = { 'sess-x': 'term-1' };
      expect(getSessionLiveness(makeNode(), map)).toBe('no-session');
    });
  });

  describe('alive-attached — sessionId is in workflowSessionMap', () => {
    it('returns alive-attached when the sessionId maps to a terminal', () => {
      const node = makeNode({ sessionId: 'sess-1' });
      const map = { 'sess-1': 'term-1' };
      expect(getSessionLiveness(node, map)).toBe('alive-attached');
    });

    it('returns alive-attached when multiple sessions are mapped and this one is among them', () => {
      const node = makeNode({ sessionId: 'sess-2' });
      const map = { 'sess-1': 'term-1', 'sess-2': 'term-2' };
      expect(getSessionLiveness(node, map)).toBe('alive-attached');
    });

    it('returns alive-attached for every node that shares the same sessionId (multi-node-share)', () => {
      const nodeA = makeNode({ sessionId: 'shared' });
      const nodeB = makeNode({ sessionId: 'shared' });
      const map = { shared: 'term-1' };
      expect(getSessionLiveness(nodeA, map)).toBe('alive-attached');
      expect(getSessionLiveness(nodeB, map)).toBe('alive-attached');
    });
  });

  describe('alive-detached — sessionId is set but not in workflowSessionMap', () => {
    it('returns alive-detached when sessionId is set and workflowSessionMap is empty', () => {
      const node = makeNode({ sessionId: 'sess-1' });
      expect(getSessionLiveness(node, {})).toBe('alive-detached');
    });

    it('returns alive-detached when sessionId is not in the map but other sessions are', () => {
      const node = makeNode({ sessionId: 'sess-orphan' });
      const map = { 'sess-other': 'term-1' };
      expect(getSessionLiveness(node, map)).toBe('alive-detached');
    });

    it('returns alive-detached after the map entry is removed (terminal closed)', () => {
      const node = makeNode({ sessionId: 'sess-1' });
      const mapBefore = { 'sess-1': 'term-1' };
      const mapAfter = {};
      expect(getSessionLiveness(node, mapBefore)).toBe('alive-attached');
      expect(getSessionLiveness(node, mapAfter)).toBe('alive-detached');
    });
  });

  describe('boundary inputs', () => {
    it('handles an empty workflowSessionMap gracefully', () => {
      expect(() => getSessionLiveness(makeNode({ sessionId: 'sess-1' }), {})).not.toThrow();
    });

    it('is a pure function — does not mutate node or map', () => {
      const node = makeNode({ sessionId: 'sess-1' });
      const map = { 'sess-1': 'term-1' };
      const nodeSnapshot = JSON.stringify(node);
      const mapSnapshot = JSON.stringify(map);
      getSessionLiveness(node, map);
      expect(JSON.stringify(node)).toBe(nodeSnapshot);
      expect(JSON.stringify(map)).toBe(mapSnapshot);
    });
  });
});
