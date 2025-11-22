import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useActiveTreeStore, useActiveTreeActions } from '../useActiveTreeStore';
import { useFilesStore } from '../../../../store/files/filesStore';
import { storeManager } from '../../../../store/storeManager';

// Mock the filesStore
vi.mock('../../../../store/files/filesStore', () => ({
  useFilesStore: vi.fn(),
}));

// Mock the storeManager
vi.mock('../../../../store/storeManager', () => ({
  storeManager: {
    getStoreForFile: vi.fn(),
  },
}));

describe('useActiveTreeStore', () => {
  const mockUseFilesStore = vi.mocked(useFilesStore);
  const mockGetStoreForFile = vi.mocked(storeManager.getStoreForFile);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no active file', () => {
    mockUseFilesStore.mockReturnValue(null);

    const { result } = renderHook(() => useActiveTreeStore());

    expect(result.current).toBe(null);
  });

  it('should return tree state when active file exists', () => {
    const mockState = {
      nodes: {},
      rootNodeId: 'root',
      activeNodeId: 'node-1',
      actions: { canUndo: vi.fn(), canRedo: vi.fn() },
    };

    const mockStore = {
      getState: vi.fn(() => mockState),
      subscribe: vi.fn(() => vi.fn()),
    };

    mockUseFilesStore.mockReturnValue('/path/to/file.arbo');
    mockGetStoreForFile.mockReturnValue(mockStore as unknown as ReturnType<typeof storeManager.getStoreForFile>);

    const { result } = renderHook(() => useActiveTreeStore());

    expect(result.current).toBe(mockState);
    expect(mockGetStoreForFile).toHaveBeenCalledWith('/path/to/file.arbo');
  });

  it('should subscribe to store changes', () => {
    const unsubscribe = vi.fn();
    // Use a stable state object to avoid infinite loops
    const stableState = { nodes: {} };
    const mockStore = {
      getState: vi.fn(() => stableState),
      subscribe: vi.fn(() => unsubscribe),
    };

    mockUseFilesStore.mockReturnValue('/path/to/file.arbo');
    mockGetStoreForFile.mockReturnValue(mockStore as unknown as ReturnType<typeof storeManager.getStoreForFile>);

    const { unmount } = renderHook(() => useActiveTreeStore());

    expect(mockStore.subscribe).toHaveBeenCalled();

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  it('should update when store state changes', () => {
    let storeCallback: (() => void) | null = null;
    const mockState1 = { nodes: {}, activeNodeId: 'node-1' };
    const mockState2 = { nodes: {}, activeNodeId: 'node-2' };
    let currentState = mockState1;

    const mockStore = {
      getState: vi.fn(() => currentState),
      subscribe: vi.fn((cb: () => void) => {
        storeCallback = cb;
        return vi.fn();
      }),
    };

    mockUseFilesStore.mockReturnValue('/path/to/file.arbo');
    mockGetStoreForFile.mockReturnValue(mockStore as unknown as ReturnType<typeof storeManager.getStoreForFile>);

    const { result } = renderHook(() => useActiveTreeStore());

    expect(result.current).toBe(mockState1);

    // Simulate store update
    currentState = mockState2;
    act(() => {
      storeCallback?.();
    });

    expect(result.current).toBe(mockState2);
  });
});

describe('useActiveTreeActions', () => {
  const mockUseFilesStore = vi.mocked(useFilesStore);
  const mockGetStoreForFile = vi.mocked(storeManager.getStoreForFile);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return null when no active file', () => {
    mockUseFilesStore.mockReturnValue(null);

    const { result } = renderHook(() => useActiveTreeActions());

    expect(result.current).toBe(null);
  });

  it('should return actions when active file exists', () => {
    const mockActions = {
      canUndo: vi.fn(),
      canRedo: vi.fn(),
      deleteNode: vi.fn(),
    };

    const mockStore = {
      getState: vi.fn(() => ({ actions: mockActions })),
      subscribe: vi.fn(() => vi.fn()),
    };

    mockUseFilesStore.mockReturnValue('/path/to/file.arbo');
    mockGetStoreForFile.mockReturnValue(mockStore as unknown as ReturnType<typeof storeManager.getStoreForFile>);

    const { result } = renderHook(() => useActiveTreeActions());

    expect(result.current).toBe(mockActions);
  });
});
