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
      canToggleStatus: false,
      canIndent: false,
      canOutdent: false,
      canSelectAll: false,
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
      collaboratingNodeId: null,
      nodes: { root: { id: 'root' }, 'node-1': { id: 'node-1' } },
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
      collaboratingNodeId: null,
      nodes: { root: { id: 'root' }, 'node-1': { id: 'node-1' } },
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
      collaboratingNodeId: null,
      nodes: { root: { id: 'root' }, 'node-1': { id: 'node-1' } },
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
      collaboratingNodeId: null,
      nodes: { root: { id: 'root' }, 'node-1': { id: 'node-1' } },
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
      collaboratingNodeId: null,
      nodes: { root: { id: 'root' }, 'node-1': { id: 'node-1' } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current.canCut).toBe(false);
    expect(result.current.canCopy).toBe(false);
    expect(result.current.canDelete).toBe(false);
  });

  it('should disable cut/delete but allow copy when collaborating', () => {
    mockUseActiveTreeStore.mockReturnValue({
      actions: {
        canUndo: vi.fn(() => false),
        canRedo: vi.fn(() => false),
      },
      activeNodeId: 'node-1',
      multiSelectedNodeIds: new Set(),
      collaboratingNodeId: 'node-2', // Collaboration in progress
      nodes: { root: { id: 'root' }, 'node-1': { id: 'node-1' } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current.canCut).toBe(false);
    expect(result.current.canCopy).toBe(true); // Copy is still allowed
    expect(result.current.canDelete).toBe(false);
  });

  it('should disable paste when collaborating', () => {
    mockUseActiveTreeStore.mockReturnValue({
      actions: {
        canUndo: vi.fn(() => false),
        canRedo: vi.fn(() => false),
      },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      collaboratingNodeId: 'node-1',
      nodes: { root: { id: 'root' }, 'node-1': { id: 'node-1' } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current.canPaste).toBe(false);
  });

  it('should enable paste when not collaborating', () => {
    mockUseActiveTreeStore.mockReturnValue({
      actions: {
        canUndo: vi.fn(() => false),
        canRedo: vi.fn(() => false),
      },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      collaboratingNodeId: null,
      nodes: { root: { id: 'root' }, 'node-1': { id: 'node-1' } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current.canPaste).toBe(true);
  });

  it('should enable new actions when activeNodeId is set', () => {
    mockUseActiveTreeStore.mockReturnValue({
      actions: {
        canUndo: vi.fn(() => false),
        canRedo: vi.fn(() => false),
      },
      activeNodeId: 'node-1',
      multiSelectedNodeIds: new Set(),
      collaboratingNodeId: null,
      nodes: { root: { id: 'root' }, 'node-1': { id: 'node-1' } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current.canToggleStatus).toBe(true);
    expect(result.current.canIndent).toBe(true);
    expect(result.current.canOutdent).toBe(true);
    expect(result.current.canSelectAll).toBe(true);
  });

  it('should disable toggle/indent/outdent when collaborating', () => {
    mockUseActiveTreeStore.mockReturnValue({
      actions: {
        canUndo: vi.fn(() => false),
        canRedo: vi.fn(() => false),
      },
      activeNodeId: 'node-1',
      multiSelectedNodeIds: new Set(),
      collaboratingNodeId: 'node-2',
      nodes: { root: { id: 'root' }, 'node-1': { id: 'node-1' } },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current.canToggleStatus).toBe(false);
    expect(result.current.canIndent).toBe(false);
    expect(result.current.canOutdent).toBe(false);
    // Select all doesn't depend on collaboration
    expect(result.current.canSelectAll).toBe(true);
  });

  it('should disable selectAll when only root node exists', () => {
    mockUseActiveTreeStore.mockReturnValue({
      actions: {
        canUndo: vi.fn(() => false),
        canRedo: vi.fn(() => false),
      },
      activeNodeId: null,
      multiSelectedNodeIds: new Set(),
      collaboratingNodeId: null,
      nodes: { root: { id: 'root' } }, // Only root node
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const { result } = renderHook(() => useEditMenuState());

    expect(result.current.canSelectAll).toBe(false);
  });
});
