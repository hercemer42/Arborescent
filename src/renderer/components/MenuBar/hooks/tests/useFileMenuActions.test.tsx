import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFileMenuActions } from '../useFileMenuActions';
import * as filesStoreModule from '../../../../store/files/filesStore';

// Mock the filesStore
vi.mock('../../../../store/files/filesStore', () => ({
  useFilesStore: vi.fn(),
}));

describe('useFileMenuActions', () => {
  const mockUseFilesStore = vi.mocked(filesStoreModule.useFilesStore);
  const originalLocation = window.location;

  const mockActions = {
    createNewFile: vi.fn(),
    openFileWithDialog: vi.fn(),
    saveActiveFile: vi.fn(),
    saveFileAs: vi.fn(),
    closeFile: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock window.location.reload
    Object.defineProperty(window, 'location', {
      value: { reload: vi.fn() },
      writable: true,
    });
  });

  afterEach(() => {
    // Restore window.location
    Object.defineProperty(window, 'location', {
      value: originalLocation,
      writable: true,
    });
  });

  describe('handleNew', () => {
    it('should call actions.createNewFile', async () => {
      mockActions.createNewFile.mockResolvedValue(undefined);

      mockUseFilesStore.mockImplementation((selector) => {
        const state = {
          actions: mockActions,
          activeFilePath: null,
        };
        return selector(state as unknown as ReturnType<typeof filesStoreModule.useFilesStore.getState>);
      });

      const { result } = renderHook(() => useFileMenuActions());

      await act(async () => {
        await result.current.handleNew();
      });

      expect(mockActions.createNewFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleOpen', () => {
    it('should call actions.openFileWithDialog', async () => {
      mockActions.openFileWithDialog.mockResolvedValue(undefined);

      mockUseFilesStore.mockImplementation((selector) => {
        const state = {
          actions: mockActions,
          activeFilePath: null,
        };
        return selector(state as unknown as ReturnType<typeof filesStoreModule.useFilesStore.getState>);
      });

      const { result } = renderHook(() => useFileMenuActions());

      await act(async () => {
        await result.current.handleOpen();
      });

      expect(mockActions.openFileWithDialog).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleSave', () => {
    it('should call actions.saveActiveFile', async () => {
      mockActions.saveActiveFile.mockResolvedValue(undefined);

      mockUseFilesStore.mockImplementation((selector) => {
        const state = {
          actions: mockActions,
          activeFilePath: '/path/to/file.arbo',
        };
        return selector(state as unknown as ReturnType<typeof filesStoreModule.useFilesStore.getState>);
      });

      const { result } = renderHook(() => useFileMenuActions());

      await act(async () => {
        await result.current.handleSave();
      });

      expect(mockActions.saveActiveFile).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleSaveAs', () => {
    it('should call actions.saveFileAs with activeFilePath when file is open', async () => {
      mockActions.saveFileAs.mockResolvedValue(undefined);
      const activeFilePath = '/path/to/file.arbo';

      mockUseFilesStore.mockImplementation((selector) => {
        const state = {
          actions: mockActions,
          activeFilePath,
        };
        return selector(state as unknown as ReturnType<typeof filesStoreModule.useFilesStore.getState>);
      });

      const { result } = renderHook(() => useFileMenuActions());

      await act(async () => {
        await result.current.handleSaveAs();
      });

      expect(mockActions.saveFileAs).toHaveBeenCalledWith(activeFilePath);
    });

    it('should not call actions.saveFileAs when no active file', async () => {
      mockUseFilesStore.mockImplementation((selector) => {
        const state = {
          actions: mockActions,
          activeFilePath: null,
        };
        return selector(state as unknown as ReturnType<typeof filesStoreModule.useFilesStore.getState>);
      });

      const { result } = renderHook(() => useFileMenuActions());

      await act(async () => {
        await result.current.handleSaveAs();
      });

      expect(mockActions.saveFileAs).not.toHaveBeenCalled();
    });
  });

  describe('handleCloseTab', () => {
    it('should call actions.closeFile with activeFilePath when file is open', async () => {
      mockActions.closeFile.mockResolvedValue(undefined);
      const activeFilePath = '/path/to/file.arbo';

      mockUseFilesStore.mockImplementation((selector) => {
        const state = {
          actions: mockActions,
          activeFilePath,
        };
        return selector(state as unknown as ReturnType<typeof filesStoreModule.useFilesStore.getState>);
      });

      const { result } = renderHook(() => useFileMenuActions());

      await act(async () => {
        await result.current.handleCloseTab();
      });

      expect(mockActions.closeFile).toHaveBeenCalledWith(activeFilePath);
    });

    it('should not call actions.closeFile when no active file', async () => {
      mockUseFilesStore.mockImplementation((selector) => {
        const state = {
          actions: mockActions,
          activeFilePath: null,
        };
        return selector(state as unknown as ReturnType<typeof filesStoreModule.useFilesStore.getState>);
      });

      const { result } = renderHook(() => useFileMenuActions());

      await act(async () => {
        await result.current.handleCloseTab();
      });

      expect(mockActions.closeFile).not.toHaveBeenCalled();
    });
  });

  describe('handleReload', () => {
    it('should call window.location.reload', () => {
      mockUseFilesStore.mockImplementation((selector) => {
        const state = {
          actions: mockActions,
          activeFilePath: null,
        };
        return selector(state as unknown as ReturnType<typeof filesStoreModule.useFilesStore.getState>);
      });

      const { result } = renderHook(() => useFileMenuActions());

      act(() => {
        result.current.handleReload();
      });

      expect(window.location.reload).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleQuit', () => {
    it('should call window.electron.appQuit', () => {
      mockUseFilesStore.mockImplementation((selector) => {
        const state = {
          actions: mockActions,
          activeFilePath: null,
        };
        return selector(state as unknown as ReturnType<typeof filesStoreModule.useFilesStore.getState>);
      });

      const { result } = renderHook(() => useFileMenuActions());

      act(() => {
        result.current.handleQuit();
      });

      expect(window.electron.appQuit).toHaveBeenCalledTimes(1);
    });
  });

  describe('memoization', () => {
    it('should return stable function references when dependencies do not change', () => {
      mockUseFilesStore.mockImplementation((selector) => {
        const state = {
          actions: mockActions,
          activeFilePath: '/path/to/file.arbo',
        };
        return selector(state as unknown as ReturnType<typeof filesStoreModule.useFilesStore.getState>);
      });

      const { result, rerender } = renderHook(() => useFileMenuActions());

      const firstRender = result.current;
      rerender();
      const secondRender = result.current;

      expect(firstRender.handleNew).toBe(secondRender.handleNew);
      expect(firstRender.handleOpen).toBe(secondRender.handleOpen);
      expect(firstRender.handleSave).toBe(secondRender.handleSave);
      expect(firstRender.handleReload).toBe(secondRender.handleReload);
    });

    it('should update handleSaveAs and handleCloseTab when activeFilePath changes', () => {
      let activeFilePath: string | null = '/path/to/file.arbo';

      mockUseFilesStore.mockImplementation((selector) => {
        const state = {
          actions: mockActions,
          activeFilePath,
        };
        return selector(state as unknown as ReturnType<typeof filesStoreModule.useFilesStore.getState>);
      });

      const { result, rerender } = renderHook(() => useFileMenuActions());

      const firstSaveAs = result.current.handleSaveAs;
      const firstCloseTab = result.current.handleCloseTab;

      // Change activeFilePath
      activeFilePath = '/new/path/file.arbo';
      rerender();

      // These should be new references since activeFilePath changed
      expect(result.current.handleSaveAs).not.toBe(firstSaveAs);
      expect(result.current.handleCloseTab).not.toBe(firstCloseTab);
    });
  });
});
