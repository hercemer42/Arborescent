import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppliedContexts } from '../useAppliedContexts';
import { TreeNode } from '../../../../../shared/types';

describe('useAppliedContexts', () => {
  const createNode = (id: string, metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children: [],
    metadata,
  });

  it('should return empty array when node is undefined', () => {
    const nodes = {};
    const { result } = renderHook(() => useAppliedContexts(undefined, nodes));
    expect(result.current).toEqual([]);
  });

  it('should return empty array when node has no applied contexts', () => {
    const node = createNode('node-1');
    const nodes = { 'node-1': node };
    const { result } = renderHook(() => useAppliedContexts(node, nodes));
    expect(result.current).toEqual([]);
  });

  it('should return applied context info for single context', () => {
    const contextNode = createNode('ctx-1', { contextIcon: 'star' });
    contextNode.content = 'My Context';
    const node = createNode('node-1', { appliedContextIds: ['ctx-1'] });
    const nodes = { 'node-1': node, 'ctx-1': contextNode };

    const { result } = renderHook(() => useAppliedContexts(node, nodes));

    expect(result.current).toEqual([
      { icon: 'star', name: 'My Context' },
    ]);
  });

  it('should return applied context info for multiple contexts', () => {
    const ctx1 = createNode('ctx-1', { contextIcon: 'star' });
    ctx1.content = 'Context 1';
    const ctx2 = createNode('ctx-2', { contextIcon: 'flag' });
    ctx2.content = 'Context 2';
    const node = createNode('node-1', { appliedContextIds: ['ctx-1', 'ctx-2'] });
    const nodes = { 'node-1': node, 'ctx-1': ctx1, 'ctx-2': ctx2 };

    const { result } = renderHook(() => useAppliedContexts(node, nodes));

    expect(result.current).toHaveLength(2);
    expect(result.current[0]).toEqual({ icon: 'star', name: 'Context 1' });
    expect(result.current[1]).toEqual({ icon: 'flag', name: 'Context 2' });
  });

  it('should filter out missing context nodes', () => {
    const ctx1 = createNode('ctx-1', { contextIcon: 'star' });
    ctx1.content = 'Context 1';
    const node = createNode('node-1', { appliedContextIds: ['ctx-1', 'missing-ctx'] });
    const nodes = { 'node-1': node, 'ctx-1': ctx1 };

    const { result } = renderHook(() => useAppliedContexts(node, nodes));

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toEqual({ icon: 'star', name: 'Context 1' });
  });

  it('should handle context without icon', () => {
    const contextNode = createNode('ctx-1');
    contextNode.content = 'No Icon Context';
    const node = createNode('node-1', { appliedContextIds: ['ctx-1'] });
    const nodes = { 'node-1': node, 'ctx-1': contextNode };

    const { result } = renderHook(() => useAppliedContexts(node, nodes));

    expect(result.current).toEqual([
      { icon: undefined, name: 'No Icon Context' },
    ]);
  });
});
