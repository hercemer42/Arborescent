import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useAppliedContext } from '../useAppliedContexts';
import { BASIC_EXECUTE_CONTEXT_ID, BASIC_REVIEW_CONTEXT_ID } from '../../../../utils/nodeHelpers';
import { TreeNode } from '../../../../../shared/types';

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
      collaborate: true,
      execute: true,
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
      collaborate: true, execute: true,
      id: 'ctx-1',
    });
  });

  it('should return collaborate mode when context has collaborate contextMode', () => {
    const contextNode = createNode('ctx-1', {
      blueprintIcon: 'eye',
      isContextDeclaration: true,
      collaborate: true,
      execute: false,
    });
    contextNode.content = 'Review';
    const node = createNode('node-1', { appliedContextId: 'ctx-1' });
    const nodes = { 'node-1': node, 'ctx-1': contextNode };

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(node));
    expect(result.current?.collaborate).toBe(true);
    expect(result.current?.execute).toBe(false);
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
    expect(result.current?.collaborate).toBe(true);
    expect(result.current?.execute).toBe(false);
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

  it('should return Basic execution metadata for BASIC_EXECUTE_CONTEXT_ID', () => {
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
      collaborate: true, execute: true,
    });
  });

  it('should return Basic review metadata for BASIC_REVIEW_CONTEXT_ID', () => {
    const node = createNode('node-1', { appliedContextId: BASIC_REVIEW_CONTEXT_ID });

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes: { 'node-1': node } };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(node));
    expect(result.current).toEqual({
      icon: 'Eye',
      color: undefined,
      name: 'Basic review',
      collaborate: true, execute: false,
    });
  });


  it('should include both color and mode when context has all fields', () => {
    const contextNode = createNode('ctx-1', {
      blueprintIcon: 'bug',
      blueprintColor: '#ef4444',
      isContextDeclaration: true,
      collaborate: true,
      execute: true,
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
      collaborate: true, execute: true,
      id: 'ctx-1',
    });
  });

  it('does not expose a navigable id for BASIC_EXECUTE_CONTEXT_ID (synthetic, no declaration node)', () => {
    const node = createNode('node-1', { appliedContextId: BASIC_EXECUTE_CONTEXT_ID });

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes: { 'node-1': node } };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(node));
    expect(result.current?.id).toBeUndefined();
  });

  it('does not expose a navigable id for BASIC_REVIEW_CONTEXT_ID (synthetic, no declaration node)', () => {
    const node = createNode('node-1', { appliedContextId: BASIC_REVIEW_CONTEXT_ID });

    mockedUseStore.mockImplementation((selector) => {
      const state = { nodes: { 'node-1': node } };
      return selector(state as never);
    });

    const { result } = renderHook(() => useAppliedContext(node));
    expect(result.current?.id).toBeUndefined();
  });
});
