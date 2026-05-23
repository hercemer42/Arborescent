import { describe, it, expect } from 'vitest';
import { extractSessionBindings } from '../extractSessionBindings';
import type { TreeNode } from '@shared/types';

function node(id: string, sessionId?: string): TreeNode {
  return {
    id,
    content: '',
    children: [],
    metadata: sessionId === undefined ? {} : { sessionId },
  };
}

describe('extractSessionBindings', () => {
  it('returns one pair per node carrying a non-empty metadata.sessionId', () => {
    const nodes: Record<string, TreeNode> = {
      a: node('a', 'sess-1'),
      b: node('b', 'sess-2'),
      c: node('c'),
    };
    const pairs = extractSessionBindings(nodes);
    expect(pairs).toEqual(
      expect.arrayContaining([
        { sessionId: 'sess-1', nodeId: 'a' },
        { sessionId: 'sess-2', nodeId: 'b' },
      ]),
    );
    expect(pairs).toHaveLength(2);
  });

  it('skips nodes whose metadata.sessionId is an empty or whitespace-only string', () => {
    const nodes: Record<string, TreeNode> = {
      a: node('a', ''),
      b: node('b', '   '),
      c: node('c', 'sess-real'),
    };
    expect(extractSessionBindings(nodes)).toEqual([{ sessionId: 'sess-real', nodeId: 'c' }]);
  });

  it('returns an empty array when no node carries metadata.sessionId', () => {
    expect(extractSessionBindings({ a: node('a'), b: node('b') })).toEqual([]);
  });

  it('returns an empty array for an empty nodes map', () => {
    expect(extractSessionBindings({})).toEqual([]);
  });
});

describe('extractSessionBindings — sessionId uniqueness for the file-open seed path', () => {
  it('emits a single pair per sessionId even when multiple nodes carry the same sessionId in metadata', () => {
    const nodes: Record<string, TreeNode> = {
      a: node('a', 'sess-shared'),
      b: node('b', 'sess-shared'),
    };
    expect(extractSessionBindings(nodes)).toHaveLength(1);
  });

  it('prefers a node id present in the preferred set when one of the colliding nodes is in it', () => {
    const nodes: Record<string, TreeNode> = {
      a: node('a', 'sess-shared'),
      b: node('b', 'sess-shared'),
    };
    expect(extractSessionBindings(nodes, new Set(['b']))).toEqual([
      { sessionId: 'sess-shared', nodeId: 'b' },
    ]);
  });

  it('falls back to a deterministic pick when no node id is in the preferred set', () => {
    const nodes: Record<string, TreeNode> = {
      a: node('a', 'sess-shared'),
      b: node('b', 'sess-shared'),
    };
    const first = extractSessionBindings(nodes);
    const second = extractSessionBindings(nodes);
    expect(first).toEqual(second);
    expect(first).toHaveLength(1);
  });

  it('keeps distinct sessionIds independent — dedup is per sessionId, not global', () => {
    const nodes: Record<string, TreeNode> = {
      a: node('a', 'sess-1'),
      b: node('b', 'sess-2'),
      c: node('c', 'sess-1'),
    };
    expect(extractSessionBindings(nodes)).toHaveLength(2);
    const sessionIds = extractSessionBindings(nodes).map((p) => p.sessionId).sort();
    expect(sessionIds).toEqual(['sess-1', 'sess-2']);
  });

  it('ignores preferred ids that are not part of the candidate set for a given sessionId', () => {
    const nodes: Record<string, TreeNode> = {
      a: node('a', 'sess-shared'),
      b: node('b', 'sess-shared'),
    };
    const result = extractSessionBindings(nodes, new Set(['unrelated-node-id']));
    expect(result).toHaveLength(1);
    expect(['a', 'b']).toContain(result[0].nodeId);
  });
});
