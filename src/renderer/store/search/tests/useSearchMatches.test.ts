import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSearchMatches } from '../useSearchMatches';
import { TreeNode } from '../../../../shared/types';

describe('useSearchMatches', () => {
  const createNode = (id: string, content: string, children: string[] = []): TreeNode => ({
    id,
    content,
    children,
    metadata: {},
  });

  const sampleNodes: Record<string, TreeNode> = {
    root: createNode('root', 'Root Node', ['child-1', 'child-2', 'child-3']),
    'child-1': createNode('child-1', 'First child with apple', ['grandchild-1']),
    'child-2': createNode('child-2', 'Second child', []),
    'child-3': createNode('child-3', 'Third child with Apple too', []),
    'grandchild-1': createNode('grandchild-1', 'Grandchild with APPLE uppercase', []),
  };

  it('should return empty array for empty query', () => {
    const { result } = renderHook(() =>
      useSearchMatches('', sampleNodes, 'root')
    );

    expect(result.current).toEqual([]);
  });

  it('should return empty array for whitespace-only query', () => {
    const { result } = renderHook(() =>
      useSearchMatches('   ', sampleNodes, 'root')
    );

    expect(result.current).toEqual([]);
  });

  it('should find matches case-insensitively', () => {
    const { result } = renderHook(() =>
      useSearchMatches('apple', sampleNodes, 'root')
    );

    // Depth-first: child-1 → grandchild-1 → child-3
    expect(result.current).toEqual(['child-1', 'grandchild-1', 'child-3']);
  });

  it('should search with uppercase query', () => {
    const { result } = renderHook(() =>
      useSearchMatches('APPLE', sampleNodes, 'root')
    );

    // Depth-first: child-1 → grandchild-1 → child-3
    expect(result.current).toEqual(['child-1', 'grandchild-1', 'child-3']);
  });

  it('should return matches in depth-first tree order', () => {
    const { result } = renderHook(() =>
      useSearchMatches('child', sampleNodes, 'root')
    );

    // Depth-first: child-1 → grandchild-1 → child-2 → child-3
    expect(result.current).toEqual(['child-1', 'grandchild-1', 'child-2', 'child-3']);
  });

  it('should find partial matches', () => {
    const { result } = renderHook(() =>
      useSearchMatches('oo', sampleNodes, 'root')
    );

    expect(result.current).toEqual(['root', 'child-3']);
  });

  it('should return empty array when no matches', () => {
    const { result } = renderHook(() =>
      useSearchMatches('xyz123', sampleNodes, 'root')
    );

    expect(result.current).toEqual([]);
  });

  it('should handle empty nodes object', () => {
    const { result } = renderHook(() =>
      useSearchMatches('test', {}, 'root')
    );

    expect(result.current).toEqual([]);
  });

  it('should handle missing root node', () => {
    const { result } = renderHook(() =>
      useSearchMatches('test', sampleNodes, 'nonexistent')
    );

    expect(result.current).toEqual([]);
  });

  it('should be memoized with same inputs', () => {
    const { result, rerender } = renderHook(
      ({ query }) => useSearchMatches(query, sampleNodes, 'root'),
      { initialProps: { query: 'apple' } }
    );

    const firstResult = result.current;
    rerender({ query: 'apple' });
    const secondResult = result.current;

    expect(firstResult).toBe(secondResult);
  });

  it('should update when query changes', () => {
    const { result, rerender } = renderHook(
      ({ query }) => useSearchMatches(query, sampleNodes, 'root'),
      { initialProps: { query: 'apple' } }
    );

    // Depth-first: child-1 → grandchild-1 → child-3
    expect(result.current).toEqual(['child-1', 'grandchild-1', 'child-3']);

    rerender({ query: 'Second' });
    expect(result.current).toEqual(['child-2']);
  });
});
