import { describe, it, expect } from 'vitest';
import type { TreeNode } from '../../../shared/types';
import {
  findAllParentsOf,
  findDuplicateChildReferences,
  reconcileDuplicateChildren,
  removeNodeFromAllParents,
} from '../treeInvariants';

function node(id: string, children: string[] = []): TreeNode {
  return { id, content: id, children, metadata: {} };
}

describe('findAllParentsOf', () => {
  it('returns the single parent of a normally-placed node', () => {
    const nodes: Record<string, TreeNode> = {
      root: node('root', ['a']),
      a: node('a'),
    };
    expect(findAllParentsOf(nodes, 'a')).toEqual(['root']);
  });

  it('returns every parent that references the node', () => {
    const nodes: Record<string, TreeNode> = {
      root: node('root', ['a', 'b']),
      a: node('a', ['dup']),
      b: node('b', ['dup']),
      dup: node('dup'),
    };
    expect(findAllParentsOf(nodes, 'dup').sort()).toEqual(['a', 'b']);
  });

  it('returns an empty array when the node has no parents', () => {
    const nodes: Record<string, TreeNode> = { root: node('root') };
    expect(findAllParentsOf(nodes, 'root')).toEqual([]);
  });

  it('excludes the node itself when it self-references', () => {
    const nodes: Record<string, TreeNode> = { a: node('a', ['a']) };
    expect(findAllParentsOf(nodes, 'a')).toEqual([]);
  });
});

describe('removeNodeFromAllParents', () => {
  it('returns the input untouched when the node has no parents', () => {
    const nodes: Record<string, TreeNode> = { root: node('root') };
    expect(removeNodeFromAllParents(nodes, 'missing')).toBe(nodes);
  });

  it('removes a single reference from its sole parent', () => {
    const nodes: Record<string, TreeNode> = {
      root: node('root', ['a']),
      a: node('a'),
    };
    const result = removeNodeFromAllParents(nodes, 'a');
    expect(result.root.children).toEqual([]);
  });

  it('removes the node from every parent that references it', () => {
    const nodes: Record<string, TreeNode> = {
      root: node('root', ['a', 'b']),
      a: node('a', ['dup']),
      b: node('b', ['dup']),
      dup: node('dup'),
    };
    const result = removeNodeFromAllParents(nodes, 'dup');
    expect(result.a.children).toEqual([]);
    expect(result.b.children).toEqual([]);
  });

  it('does not mutate the input map', () => {
    const nodes: Record<string, TreeNode> = {
      root: node('root', ['a']),
      a: node('a'),
    };
    const snapshot = JSON.stringify(nodes);
    removeNodeFromAllParents(nodes, 'a');
    expect(JSON.stringify(nodes)).toBe(snapshot);
  });
});

describe('findDuplicateChildReferences', () => {
  it('returns an empty array for a tree with no duplicates', () => {
    const nodes: Record<string, TreeNode> = {
      root: node('root', ['a', 'b']),
      a: node('a'),
      b: node('b'),
    };
    expect(findDuplicateChildReferences(nodes)).toEqual([]);
  });

  it('returns the duplicated node id when a child appears in two parents', () => {
    const nodes: Record<string, TreeNode> = {
      root: node('root', ['a', 'b']),
      a: node('a', ['dup']),
      b: node('b', ['dup']),
      dup: node('dup'),
    };
    const duplicates = findDuplicateChildReferences(nodes);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toMatchObject({ nodeId: 'dup', parentIds: ['a', 'b'] });
  });

  it('returns the duplicated node id when a child appears twice in the same parent', () => {
    const nodes: Record<string, TreeNode> = {
      root: node('root', ['a', 'a']),
      a: node('a'),
    };
    const duplicates = findDuplicateChildReferences(nodes);
    expect(duplicates).toHaveLength(1);
    expect(duplicates[0]).toMatchObject({ nodeId: 'a', parentIds: ['root', 'root'] });
  });

  it('returns multiple entries when several nodes are duplicated independently', () => {
    const nodes: Record<string, TreeNode> = {
      root: node('root', ['a', 'b']),
      a: node('a', ['x', 'y']),
      b: node('b', ['x', 'y']),
      x: node('x'),
      y: node('y'),
    };
    const duplicates = findDuplicateChildReferences(nodes);
    expect(duplicates).toHaveLength(2);
    expect(duplicates.map((d) => d.nodeId).sort()).toEqual(['x', 'y']);
  });

  it('handles an empty nodes map without erroring', () => {
    expect(findDuplicateChildReferences({})).toEqual([]);
  });

  it('does not flag the same node id appearing in its own children (self-reference is a different invariant)', () => {
    const nodes: Record<string, TreeNode> = {
      a: node('a', ['a']),
    };
    const duplicates = findDuplicateChildReferences(nodes);
    expect(duplicates).toEqual([]);
  });

  it('ignores children ids that do not resolve to nodes (dangling reference)', () => {
    const nodes: Record<string, TreeNode> = {
      root: node('root', ['missing']),
    };
    expect(findDuplicateChildReferences(nodes)).toEqual([]);
  });
});

describe('reconcileDuplicateChildren', () => {
  it('returns the original map untouched when there are no duplicates', () => {
    const nodes: Record<string, TreeNode> = {
      root: node('root', ['a']),
      a: node('a'),
    };
    const result = reconcileDuplicateChildren(nodes);
    expect(result.nodes).toEqual(nodes);
    expect(result.removed).toEqual([]);
  });

  it('keeps the first reference and removes subsequent ones across parents', () => {
    const nodes: Record<string, TreeNode> = {
      root: node('root', ['a', 'b']),
      a: node('a', ['dup']),
      b: node('b', ['dup']),
      dup: node('dup'),
    };
    const result = reconcileDuplicateChildren(nodes);

    expect(result.nodes.a.children).toEqual(['dup']);
    expect(result.nodes.b.children).toEqual([]);
    expect(result.removed).toEqual([{ nodeId: 'dup', removedFrom: 'b' }]);
  });

  it('removes repeated references within the same parent', () => {
    const nodes: Record<string, TreeNode> = {
      root: node('root', ['a', 'a', 'b', 'a']),
      a: node('a'),
      b: node('b'),
    };
    const result = reconcileDuplicateChildren(nodes);
    expect(result.nodes.root.children).toEqual(['a', 'b']);
  });

  it('preserves order when deduping within a parent', () => {
    const nodes: Record<string, TreeNode> = {
      root: node('root', ['a', 'b', 'a', 'c', 'b']),
      a: node('a'),
      b: node('b'),
      c: node('c'),
    };
    const result = reconcileDuplicateChildren(nodes);
    expect(result.nodes.root.children).toEqual(['a', 'b', 'c']);
  });

  it('returns a new nodes map rather than mutating the input', () => {
    const nodes: Record<string, TreeNode> = {
      root: node('root', ['a', 'a']),
      a: node('a'),
    };
    const snapshot = JSON.stringify(nodes);
    reconcileDuplicateChildren(nodes);
    expect(JSON.stringify(nodes)).toBe(snapshot);
  });
});
