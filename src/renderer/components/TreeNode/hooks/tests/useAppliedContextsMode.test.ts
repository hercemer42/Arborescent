import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppliedContext } from '../useAppliedContexts';
import { TreeNode } from '../../../../../shared/types';
import { BASIC_EXECUTE_CONTEXT_ID } from '../../../../utils/nodeHelpers';

// Mock the useStore hook
vi.mock('../../../../store/tree/useStore', () => ({
  useStore: vi.fn(),
}));

import { useStore } from '../../../../store/tree/useStore';
const mockedUseStore = vi.mocked(useStore);

describe('useAppliedContext — mode field', () => {
  const createNode = (id: string, metadata = {}): TreeNode => ({
    id,
    content: `Node ${id}`,
    children: [],
    metadata,
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should include mode from context declaration metadata', () => {
    const contextNode = createNode('ctx-1', {
      blueprintIcon: 'wrench',
      isContextDeclaration: true,
      contextMode: 'execute',
    });
    contextNode.content = 'Build Feature';
    const node = createNode('node-1', { appliedContextId: 'ctx-1' });
    const nodes = { 'node-1': node, 'ctx-1': contextNode };

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(node));
    expect(result.current).toEqual({
      icon: 'wrench',
      color: undefined,
      name: 'Build Feature',
      mode: 'execute',
    });
  });

  it('should return collaborate mode when context has collaborate contextMode', () => {
    const contextNode = createNode('ctx-1', {
      blueprintIcon: 'eye',
      isContextDeclaration: true,
      contextMode: 'collaborate',
    });
    contextNode.content = 'Review';
    const node = createNode('node-1', { appliedContextId: 'ctx-1' });
    const nodes = { 'node-1': node, 'ctx-1': contextNode };

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(node));
    expect(result.current?.mode).toBe('collaborate');
  });

  it('should default to collaborate mode when context declaration has no contextMode', () => {
    const contextNode = createNode('ctx-1', {
      blueprintIcon: 'star',
      isContextDeclaration: true,
      // no contextMode
    });
    contextNode.content = 'Legacy Context';
    const node = createNode('node-1', { appliedContextId: 'ctx-1' });
    const nodes = { 'node-1': node, 'ctx-1': contextNode };

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(node));
    expect(result.current?.mode).toBe('collaborate');
  });

  it('should return undefined when no applied context exists (mode not applicable)', () => {
    const node = createNode('node-1');
    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes: { 'node-1': node } };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(node));
    expect(result.current).toBeUndefined();
  });

  it('should return Basic execution for BASIC_EXECUTE_CONTEXT_ID', () => {
    const node = createNode('node-1', { appliedContextId: BASIC_EXECUTE_CONTEXT_ID });

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes: { 'node-1': node } };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(node));
    expect(result.current).toEqual({
      icon: 'Zap',
      color: undefined,
      name: 'Basic execution',
      mode: 'execute',
    });
  });

  it('should include both color and mode when context has all fields', () => {
    const contextNode = createNode('ctx-1', {
      blueprintIcon: 'bug',
      blueprintColor: '#ef4444',
      isContextDeclaration: true,
      contextMode: 'execute',
    });
    contextNode.content = 'Bug Fix';
    const node = createNode('node-1', { appliedContextId: 'ctx-1' });
    const nodes = { 'node-1': node, 'ctx-1': contextNode };

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(node));
    expect(result.current).toEqual({
      icon: 'bug',
      color: '#ef4444',
      name: 'Bug Fix',
      mode: 'execute',
    });
  });
});
