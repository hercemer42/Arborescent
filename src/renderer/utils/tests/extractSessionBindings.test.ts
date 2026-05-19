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
