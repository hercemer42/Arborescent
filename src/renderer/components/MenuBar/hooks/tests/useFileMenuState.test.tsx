import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useFileMenuState } from '../useFileMenuState';
import * as filesStoreModule from '../../../../store/files/filesStore';

// Mock the filesStore
vi.mock('../../../../store/files/filesStore', () => ({
  useFilesStore: vi.fn(),
}));

describe('useFileMenuState', () => {
  const mockUseFilesStore = vi.mocked(filesStoreModule.useFilesStore);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return hasActiveFile as false when activeFilePath is null', () => {
    mockUseFilesStore.mockImplementation((selector) => {
      const state = { activeFilePath: null };
      return selector(state as ReturnType<typeof filesStoreModule.useFilesStore.getState>);
    });

    const { result } = renderHook(() => useFileMenuState());

    expect(result.current.hasActiveFile).toBe(false);
  });

  it('should return hasActiveFile as true when activeFilePath is set', () => {
    mockUseFilesStore.mockImplementation((selector) => {
      const state = { activeFilePath: '/path/to/file.arbo' };
      return selector(state as ReturnType<typeof filesStoreModule.useFilesStore.getState>);
    });

    const { result } = renderHook(() => useFileMenuState());

    expect(result.current.hasActiveFile).toBe(true);
  });

  it('should return hasActiveFile as true for any non-null path', () => {
    mockUseFilesStore.mockImplementation((selector) => {
      const state = { activeFilePath: 'temp-file-123' };
      return selector(state as ReturnType<typeof filesStoreModule.useFilesStore.getState>);
    });

    const { result } = renderHook(() => useFileMenuState());

    expect(result.current.hasActiveFile).toBe(true);
  });

  it('should update when activeFilePath changes', () => {
    let activeFilePath: string | null = null;

    mockUseFilesStore.mockImplementation((selector) => {
      const state = { activeFilePath };
      return selector(state as ReturnType<typeof filesStoreModule.useFilesStore.getState>);
    });

    const { result, rerender } = renderHook(() => useFileMenuState());

    expect(result.current.hasActiveFile).toBe(false);

    // Simulate change
    activeFilePath = '/new/file.arbo';
    rerender();

    expect(result.current.hasActiveFile).toBe(true);
  });
});
