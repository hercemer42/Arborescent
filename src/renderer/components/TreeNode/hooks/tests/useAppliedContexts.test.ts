import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppliedContext, useAppliedContexts, useActionContexts } from '../useAppliedContexts';
import { TreeNode } from '../../../../../shared/types';

// Mock the useStore hook
vi.mock('../../../../store/tree/useStore', () => ({
  useStore: vi.fn(),
}));

import { useStore } from '../../../../store/tree/useStore';
const mockedUseStore = vi.mocked(useStore);

describe('useAppliedContext', () => {
  const createNode = (id: string, metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children: [],
    metadata,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return undefined when node is undefined', () => {
    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes: {} };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(undefined));
    expect(result.current).toBeUndefined();
  });

  it('should return undefined when node has no applied context', () => {
    const node = createNode('node-1');
    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes: { 'node-1': node } };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(node));
    expect(result.current).toBeUndefined();
  });

  it('should return applied context info when appliedContextId is set', () => {
    const contextNode = createNode('ctx-1', { blueprintIcon: 'star' });
    contextNode.content = 'My Context';
    const node = createNode('node-1', { appliedContextId: 'ctx-1' });
    const nodes = { 'node-1': node, 'ctx-1': contextNode };

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(node));
    expect(result.current).toEqual({ icon: 'star', color: undefined, name: 'My Context' });
  });

  it('should include color when context has blueprintColor', () => {
    const contextNode = createNode('ctx-1', { blueprintIcon: 'star', blueprintColor: '#ff0000' });
    contextNode.content = 'My Context';
    const node = createNode('node-1', { appliedContextId: 'ctx-1' });
    const nodes = { 'node-1': node, 'ctx-1': contextNode };

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(node));
    expect(result.current).toEqual({ icon: 'star', color: '#ff0000', name: 'My Context' });
  });

  it('should return undefined when context node does not exist', () => {
    const node = createNode('node-1', { appliedContextId: 'missing-ctx' });
    const nodes = { 'node-1': node };

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(node));
    expect(result.current).toBeUndefined();
  });

  it('should handle content with colons correctly', () => {
    const contextNode = createNode('ctx-1', { blueprintIcon: 'star' });
    contextNode.content = 'Context: with: colons';
    const node = createNode('node-1', { appliedContextId: 'ctx-1' });
    const nodes = { 'node-1': node, 'ctx-1': contextNode };

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(node));
    expect(result.current?.name).toBe('Context: with: colons');
  });
});

describe('useAppliedContexts (legacy)', () => {
  it('should return empty array for backwards compatibility', () => {
    const node = { id: 'test', content: '', children: [], metadata: {} };
    const { result } = renderHook(() => useAppliedContexts(node));
    expect(result.current).toEqual([]);
  });
});

describe('useActionContexts (legacy)', () => {
  it('should return undefined for both contexts for backwards compatibility', () => {
    const node = { id: 'test', content: '', children: [], metadata: {} };
    const { result } = renderHook(() => useActionContexts(node));
    expect(result.current).toEqual({
      executeContext: undefined,
      collaborateContext: undefined,
    });
  });
});
