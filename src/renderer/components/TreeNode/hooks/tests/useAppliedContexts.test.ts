import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppliedContexts } from '../useAppliedContexts';
import { TreeNode } from '../../../../../shared/types';

// Mock the useStore hook
vi.mock('../../../../store/tree/useStore', () => ({
  useStore: vi.fn(),
}));

import { useStore } from '../../../../store/tree/useStore';
const mockedUseStore = vi.mocked(useStore);

describe('useAppliedContexts', () => {
  const createNode = (id: string, metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children: [],
    metadata,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when node is undefined', () => {
    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes: {}, ancestorRegistry: {} };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContexts(undefined));
    expect(result.current).toEqual([]);
  });

  it('should return empty array when node has no applied contexts', () => {
    const node = createNode('node-1');
    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes: { 'node-1': node }, ancestorRegistry: {} };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContexts(node));
    expect(result.current).toEqual([]);
  });

  it('should return applied context info for single context', () => {
    const contextNode = createNode('ctx-1', { blueprintIcon: 'star' });
    contextNode.content = 'My Context';
    const node = createNode('node-1', { appliedContextIds: ['ctx-1'] });
    const nodes = { 'node-1': node, 'ctx-1': contextNode };

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes, ancestorRegistry: {} };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContexts(node));

    expect(result.current).toEqual([
      { icon: 'star', color: undefined, name: 'My Context' },
    ]);
  });

  it('should return applied context info for multiple contexts', () => {
    const ctx1 = createNode('ctx-1', { blueprintIcon: 'star' });
    ctx1.content = 'Context 1';
    const ctx2 = createNode('ctx-2', { blueprintIcon: 'flag' });
    ctx2.content = 'Context 2';
    const node = createNode('node-1', { appliedContextIds: ['ctx-1', 'ctx-2'] });
    const nodes = { 'node-1': node, 'ctx-1': ctx1, 'ctx-2': ctx2 };

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes, ancestorRegistry: {} };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContexts(node));

    expect(result.current).toHaveLength(2);
    expect(result.current[0]).toEqual({ icon: 'star', color: undefined, name: 'Context 1' });
    expect(result.current[1]).toEqual({ icon: 'flag', color: undefined, name: 'Context 2' });
  });

  it('should filter out missing context nodes', () => {
    const ctx1 = createNode('ctx-1', { blueprintIcon: 'star' });
    ctx1.content = 'Context 1';
    const node = createNode('node-1', { appliedContextIds: ['ctx-1', 'missing-ctx'] });
    const nodes = { 'node-1': node, 'ctx-1': ctx1 };

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes, ancestorRegistry: {} };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContexts(node));

    expect(result.current).toHaveLength(1);
    expect(result.current[0]).toEqual({ icon: 'star', color: undefined, name: 'Context 1' });
  });

  it('should handle context without icon', () => {
    const contextNode = createNode('ctx-1');
    contextNode.content = 'No Icon Context';
    const node = createNode('node-1', { appliedContextIds: ['ctx-1'] });
    const nodes = { 'node-1': node, 'ctx-1': contextNode };

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes, ancestorRegistry: {} };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContexts(node));

    expect(result.current).toEqual([
      { icon: undefined, color: undefined, name: 'No Icon Context' },
    ]);
  });
});
