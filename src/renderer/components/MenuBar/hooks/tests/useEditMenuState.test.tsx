import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useEditMenuState } from '../useEditMenuState';
import * as useActiveTreeStoreModule from '../useActiveTreeStore';

// Mock the useActiveTreeStore hook
vi.mock('../useActiveTreeStore', () => ({
  useActiveTreeStore: vi.fn(),
}));

describe('useEditMenuState', () => {
  const mockUseActiveTreeStore = vi.mocked(useActiveTreeStoreModule.useActiveTreeStore);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return all false when no active tree store', () => {
    mockUseActiveTreeStore.mockReturnValue(null);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current).toEqual({
      canUndo: false,
      canRedo: false,
      canCut: false,
      canCopy: false,
      canPaste: false,
      canDelete: false,
    });
  });

  it('should return canUndo true when undo is available', () => {
    mockUseActiveTreeStore.mockReturnValue({
      actions: {
        canUndo: vi.fn(() => true),
        canRedo: vi.fn(() => false),
      },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      reviewingNodeId: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current.canUndo).toBe(true);
    expect(result.current.canRedo).toBe(false);
  });

  it('should return canRedo true when redo is available', () => {
    mockUseActiveTreeStore.mockReturnValue({
      actions: {
        canUndo: vi.fn(() => false),
        canRedo: vi.fn(() => true),
      },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      reviewingNodeId: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(true);
  });

  it('should enable cut/copy/delete when activeNodeId is set', () => {
    mockUseActiveTreeStore.mockReturnValue({
      actions: {
        canUndo: vi.fn(() => false),
        canRedo: vi.fn(() => false),
      },
      activeNodeId: 'node-1',
      multiSelectedNodeIds: new Set(),
      reviewingNodeId: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current.canCut).toBe(true);
    expect(result.current.canCopy).toBe(true);
    expect(result.current.canDelete).toBe(true);
  });

  it('should enable cut/copy/delete when multiSelectedNodeIds is not empty', () => {
    mockUseActiveTreeStore.mockReturnValue({
      actions: {
        canUndo: vi.fn(() => false),
        canRedo: vi.fn(() => false),
      },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(['node-1', 'node-2']),
      reviewingNodeId: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current.canCut).toBe(true);
    expect(result.current.canCopy).toBe(true);
    expect(result.current.canDelete).toBe(true);
  });

  it('should disable cut/copy/delete when no node is selected', () => {
    mockUseActiveTreeStore.mockReturnValue({
      actions: {
        canUndo: vi.fn(() => false),
        canRedo: vi.fn(() => false),
      },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      reviewingNodeId: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current.canCut).toBe(false);
    expect(result.current.canCopy).toBe(false);
    expect(result.current.canDelete).toBe(false);
  });

  it('should disable cut/delete but allow copy when reviewing', () => {
    mockUseActiveTreeStore.mockReturnValue({
      actions: {
        canUndo: vi.fn(() => false),
        canRedo: vi.fn(() => false),
      },
      activeNodeId: 'node-1',
      multiSelectedNodeIds: new Set(),
      reviewingNodeId: 'node-2', // Review in progress
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current.canCut).toBe(false);
    expect(result.current.canCopy).toBe(true); // Copy is still allowed
    expect(result.current.canDelete).toBe(false);
  });

  it('should disable paste when reviewing', () => {
    mockUseActiveTreeStore.mockReturnValue({
      actions: {
        canUndo: vi.fn(() => false),
        canRedo: vi.fn(() => false),
      },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      reviewingNodeId: 'node-1',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current.canPaste).toBe(false);
  });

  it('should enable paste when not reviewing', () => {
    mockUseActiveTreeStore.mockReturnValue({
      actions: {
        canUndo: vi.fn(() => false),
        canRedo: vi.fn(() => false),
      },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      reviewingNodeId: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current.canPaste).toBe(true);
  });
});
