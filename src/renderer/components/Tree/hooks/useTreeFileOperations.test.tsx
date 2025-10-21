import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTreeFileOperations } from './useTreeFileOperations';
import { TreeStoreContext } from '../../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../../store/tree/treeStore';
import { storeManager } from '../../../store/storeManager';
import { useTabsStore } from '../../../store/tabs/tabsStore';
import { ElectronStorageService } from '@platform/storage';

vi.mock('../../../store/storeManager');
vi.mock('@platform/storage');

describe('useTreeFileOperations', () => {
  let store: TreeStore;
  let fileStore: TreeStore;
  const mockLoadFromPath = vi.fn();
  const mockSaveToPath = vi.fn();
  const mockShowOpenDialog = vi.fn();
  const mockShowSaveDialog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset tabsStore
    useTabsStore.setState({
      openFiles: [],
      activeFilePath: null,
    });

    store = createTreeStore();
    store.setState({
      nodes: {},
      rootNodeId: '',
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: null,
      fileMeta: null,
      actions: {
        loadFromPath: mockLoadFromPath,
        saveToPath: mockSaveToPath,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    // Create a separate store for file operations
    fileStore = createTreeStore();
    fileStore.setState({
      nodes: {},
      rootNodeId: '',
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      currentFilePath: null,
      fileMeta: null,
      actions: {
        loadFromPath: mockLoadFromPath,
        saveToPath: mockSaveToPath,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    // Mock storeManager
    vi.mocked(storeManager.getStoreForFile).mockReturnValue(fileStore);

    // Mock storage service
    vi.mocked(ElectronStorageService.prototype.showOpenDialog).mockImplementation(mockShowOpenDialog);
    vi.mocked(ElectronStorageService.prototype.showSaveDialog).mockImplementation(mockShowSaveDialog);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  describe('handleLoad', () => {
    it('should load file and add tab when path is selected', async () => {
      const mockMeta = { created: '2025-01-01', author: 'Test' };
      mockShowOpenDialog.mockResolvedValue('/test/path.arbo');
      mockLoadFromPath.mockResolvedValue(mockMeta);

      const { result } = renderHook(() => useTreeFileOperations(), { wrapper });

      await result.current.handleLoad();

      expect(mockShowOpenDialog).toHaveBeenCalled();
      expect(storeManager.getStoreForFile).toHaveBeenCalledWith('/test/path.arbo');
      expect(mockLoadFromPath).toHaveBeenCalledWith('/test/path.arbo');

      // Should add tab
      const tabsState = useTabsStore.getState();
      expect(tabsState.openFiles).toHaveLength(1);
      expect(tabsState.openFiles[0]).toEqual({
        path: '/test/path.arbo',
        displayName: 'path.arbo',
      });
      expect(tabsState.activeFilePath).toBe('/test/path.arbo');
    });

    it('should not load when dialog is cancelled', async () => {
      mockShowOpenDialog.mockResolvedValue(null);

      const { result } = renderHook(() => useTreeFileOperations(), { wrapper });

      await result.current.handleLoad();

      expect(mockShowOpenDialog).toHaveBeenCalled();
      expect(storeManager.getStoreForFile).not.toHaveBeenCalled();
      expect(mockLoadFromPath).not.toHaveBeenCalled();
    });

    it('should handle load errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockShowOpenDialog.mockResolvedValue('/test/path.arbo');
      mockLoadFromPath.mockRejectedValue(new Error('Load failed'));

      const { result } = renderHook(() => useTreeFileOperations(), { wrapper });

      await result.current.handleLoad();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();

      // Should not add tab when load fails
      const tabsState = useTabsStore.getState();
      expect(tabsState.openFiles).toHaveLength(0);
    });
  });

  describe('handleSave', () => {
    it('should save to current path when file already has path', async () => {
      store.setState({ currentFilePath: '/test/existing.arbo' });
      mockSaveToPath.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTreeFileOperations(), { wrapper });

      await result.current.handleSave();

      expect(mockShowSaveDialog).not.toHaveBeenCalled();
      expect(mockSaveToPath).toHaveBeenCalledWith('/test/existing.arbo', undefined);
    });

    it('should show save dialog when no current path', async () => {
      mockShowSaveDialog.mockResolvedValue('/test/new.arbo');
      mockSaveToPath.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTreeFileOperations(), { wrapper });

      await result.current.handleSave();

      expect(mockShowSaveDialog).toHaveBeenCalled();
      expect(mockSaveToPath).toHaveBeenCalledWith('/test/new.arbo', undefined);
    });

    it('should not save when dialog is cancelled', async () => {
      mockShowSaveDialog.mockResolvedValue(null);

      const { result } = renderHook(() => useTreeFileOperations(), { wrapper });

      await result.current.handleSave();

      expect(mockShowSaveDialog).toHaveBeenCalled();
      expect(mockSaveToPath).not.toHaveBeenCalled();
    });

    it('should handle save errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockShowSaveDialog.mockResolvedValue('/test/path.arbo');
      mockSaveToPath.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useTreeFileOperations(), { wrapper });

      await result.current.handleSave();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleSaveAs', () => {
    it('should show save dialog and save to new path', async () => {
      mockShowSaveDialog.mockResolvedValue('/test/saveas.arbo');
      mockSaveToPath.mockResolvedValue(undefined);

      const { result } = renderHook(() => useTreeFileOperations(), { wrapper });

      await result.current.handleSaveAs();

      expect(mockShowSaveDialog).toHaveBeenCalled();
      expect(mockSaveToPath).toHaveBeenCalledWith('/test/saveas.arbo', undefined);
    });

    it('should not save when dialog is cancelled', async () => {
      mockShowSaveDialog.mockResolvedValue(null);

      const { result } = renderHook(() => useTreeFileOperations(), { wrapper });

      await result.current.handleSaveAs();

      expect(mockShowSaveDialog).toHaveBeenCalled();
      expect(mockSaveToPath).not.toHaveBeenCalled();
    });

    it('should handle save as errors', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockShowSaveDialog.mockResolvedValue('/test/path.arbo');
      mockSaveToPath.mockRejectedValue(new Error('Save failed'));

      const { result } = renderHook(() => useTreeFileOperations(), { wrapper });

      await result.current.handleSaveAs();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
