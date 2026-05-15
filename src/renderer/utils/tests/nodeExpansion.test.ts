import { describe, it, expect } from 'vitest';
import { expandCollapsedAncestors } from '../nodeExpansion';
import type { TreeNode } from '@shared/types';

function n(id: string, children: string[], expanded?: boolean): TreeNode {
  return {
    id,
    content: id,
    children,
    metadata: expanded === undefined ? {} : { expanded },
  };
}

describe('expandCollapsedAncestors', () => {
  it('expands every collapsed ancestor on the chain', () => {
    const nodes: Record<string, TreeNode> = {
      'root': n('root', ['a']),
      'a': n('a', ['b'], false),
      'b': n('b', ['c'], false),
      'c': n('c', []),
    };
    const ancestors = {
      'root': [],
      'a': ['root'],
      'b': ['root', 'a'],
      'c': ['root', 'a', 'b'],
    };

    const result = expandCollapsedAncestors(nodes, ancestors, 'c');

    expect(result.changed).toBe(true);
    expect(result.nodes['a'].metadata.expanded).toBe(true);
    expect(result.nodes['b'].metadata.expanded).toBe(true);
  });

  it('leaves already-expanded ancestors alone and reports no change when none are collapsed', () => {
    const nodes: Record<string, TreeNode> = {
      'root': n('root', ['a']),
      'a': n('a', ['b'], true),
      'b': n('b', []),
    };
    const ancestors = { 'root': [], 'a': ['root'], 'b': ['root', 'a'] };

    const result = expandCollapsedAncestors(nodes, ancestors, 'b');

    expect(result.changed).toBe(false);
    expect(result.nodes).toBe(nodes);
  });

  it('returns the original nodes ref unchanged when the node has no ancestors', () => {
    const nodes: Record<string, TreeNode> = {
      'root': n('root', []),
    };

    const result = expandCollapsedAncestors(nodes, { 'root': [] }, 'root');

    expect(result.changed).toBe(false);
    expect(result.nodes).toBe(nodes);
  });

  it('skips ancestors that have no children even if marked collapsed', () => {
    const nodes: Record<string, TreeNode> = {
      'root': n('root', ['a']),
      'a': n('a', [], false),
    };
    const ancestors = { 'root': [], 'a': ['root'] };

    const result = expandCollapsedAncestors(nodes, ancestors, 'a');

    expect(result.changed).toBe(false);
  });
});
