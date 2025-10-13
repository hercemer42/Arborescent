import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTreeListeners } from './useTreeListeners';
import { TreeStoreContext } from '../../store/tree/TreeStoreContext';
import { createTreeStore, TreeStore } from '../../store/tree/treeStore';
import { storeManager } from '../../store/storeManager';
import { useTabsStore } from '../../store/tabs/tabsStore';
import { hotkeyService } from '../../services/hotkeyService';

vi.mock('../../services/hotkeyService');
vi.mock('../../store/storeManager');

describe('useTreeListeners', () => {
  let store: TreeStore;
  let fileStore: TreeStore;
  const mockLoadFromPath = vi.fn();
  const mockSaveToPath = vi.fn();
  const mockMoveUp = vi.fn();
  const mockMoveDown = vi.fn();
  const mockOnMenuOpen = vi.fn();
  const mockOnMenuSave = vi.fn();
  const mockOnMenuSaveAs = vi.fn();
  const mockShowOpenDialog = vi.fn();
  const mockShowSaveDialog = vi.fn();
  const mockRegister = vi.fn();
  const mockHandleKeyDown = vi.fn();
  const mockUnregister = vi.fn();

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
      nodeTypeConfig: {},
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      actions: {
        loadFromPath: mockLoadFromPath,
        saveToPath: mockSaveToPath,
        moveUp: mockMoveUp,
        moveDown: mockMoveDown,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    // Create a separate store for file operations
    fileStore = createTreeStore();
    fileStore.setState({
      nodes: {},
      rootNodeId: '',
      nodeTypeConfig: {},
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedVisualX: null,
      actions: {
        loadFromPath: mockLoadFromPath,
        saveToPath: mockSaveToPath,
        moveUp: vi.fn(),
        moveDown: vi.fn(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

    // Mock storeManager
    vi.mocked(storeManager.getStoreForFile).mockReturnValue(fileStore);

    global.window.electron = {
      onMenuOpen: mockOnMenuOpen,
      onMenuSave: mockOnMenuSave,
      onMenuSaveAs: mockOnMenuSaveAs,
      showOpenDialog: mockShowOpenDialog,
      showSaveDialog: mockShowSaveDialog,
      readFile: vi.fn(),
      writeFile: vi.fn(),
      onMainError: vi.fn(),
    };

    mockRegister.mockReturnValue(mockUnregister);
    vi.mocked(hotkeyService.register).mockImplementation(mockRegister);
    vi.mocked(hotkeyService.handleKeyDown).mockImplementation(mockHandleKeyDown);
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <TreeStoreContext.Provider value={store}>{children}</TreeStoreContext.Provider>
  );

  it('should register menu listeners on mount', () => {
    renderHook(() => useTreeListeners(), { wrapper });

    expect(mockOnMenuOpen).toHaveBeenCalled();
    expect(mockOnMenuSave).toHaveBeenCalled();
    expect(mockOnMenuSaveAs).toHaveBeenCalled();
  });

  it('should register hotkey listeners on mount', () => {
    renderHook(() => useTreeListeners(), { wrapper });

    expect(mockRegister).toHaveBeenCalledWith('navigation.moveUp', expect.any(Function));
    expect(mockRegister).toHaveBeenCalledWith('navigation.moveDown', expect.any(Function));
  });

  it('should register keydown listener on mount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useTreeListeners(), { wrapper });

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should unregister listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useTreeListeners(), { wrapper });
    unmount();

    expect(mockUnregister).toHaveBeenCalledTimes(2);
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should handle load operation', async () => {
    const mockMeta = { created: '2025-01-01', author: 'Test' };
    mockShowOpenDialog.mockResolvedValue('/test/path.arbo');
    mockLoadFromPath.mockResolvedValue(mockMeta);

    renderHook(() => useTreeListeners(), { wrapper });

    const handleLoad = mockOnMenuOpen.mock.calls[0][0];
    await handleLoad();

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

    renderHook(() => useTreeListeners(), { wrapper });

    const handleLoad = mockOnMenuOpen.mock.calls[0][0];
    await handleLoad();

    expect(mockShowOpenDialog).toHaveBeenCalled();
    expect(storeManager.getStoreForFile).not.toHaveBeenCalled();
    expect(mockLoadFromPath).not.toHaveBeenCalled();
  });

  it('should handle load errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockShowOpenDialog.mockResolvedValue('/test/path.arbo');
    mockLoadFromPath.mockRejectedValue(new Error('Load failed'));

    renderHook(() => useTreeListeners(), { wrapper });

    const handleLoad = mockOnMenuOpen.mock.calls[0][0];
    await handleLoad();

    expect(consoleErrorSpy).toHaveBeenCalledWith('[FileLoad] Failed to load file: Load failed', expect.any(Error));
    consoleErrorSpy.mockRestore();

    // Should not add tab when load fails
    const tabsState = useTabsStore.getState();
    expect(tabsState.openFiles).toHaveLength(0);
  });


  it('should handle save operation without existing path', async () => {
    mockShowSaveDialog.mockResolvedValue('/test/new.arbo');
    mockSaveToPath.mockResolvedValue(undefined);

    renderHook(() => useTreeListeners(), { wrapper });

    const handleSave = mockOnMenuSave.mock.calls[0][0];
    await handleSave();

    expect(mockShowSaveDialog).toHaveBeenCalled();
    expect(mockSaveToPath).toHaveBeenCalledWith('/test/new.arbo', undefined);
  });

  it('should not save when dialog is cancelled', async () => {
    mockShowSaveDialog.mockResolvedValue(null);

    renderHook(() => useTreeListeners(), { wrapper });

    const handleSave = mockOnMenuSave.mock.calls[0][0];
    await handleSave();

    expect(mockShowSaveDialog).toHaveBeenCalled();
    expect(mockSaveToPath).not.toHaveBeenCalled();
  });

  it('should handle save errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockShowSaveDialog.mockResolvedValue('/test/path.arbo');
    mockSaveToPath.mockRejectedValue(new Error('Save failed'));

    renderHook(() => useTreeListeners(), { wrapper });

    const handleSave = mockOnMenuSave.mock.calls[0][0];
    await handleSave();

    expect(consoleErrorSpy).toHaveBeenCalledWith('[FileSave] Failed to save file: Save failed', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('should handle save as operation', async () => {
    mockShowSaveDialog.mockResolvedValue('/test/saveas.arbo');
    mockSaveToPath.mockResolvedValue(undefined);

    renderHook(() => useTreeListeners(), { wrapper });

    const handleSaveAs = mockOnMenuSaveAs.mock.calls[0][0];
    await handleSaveAs();

    expect(mockShowSaveDialog).toHaveBeenCalled();
    expect(mockSaveToPath).toHaveBeenCalledWith('/test/saveas.arbo', undefined);
  });

  it('should not save as when dialog is cancelled', async () => {
    mockShowSaveDialog.mockResolvedValue(null);

    renderHook(() => useTreeListeners(), { wrapper });

    const handleSaveAs = mockOnMenuSaveAs.mock.calls[0][0];
    await handleSaveAs();

    expect(mockShowSaveDialog).toHaveBeenCalled();
    expect(mockSaveToPath).not.toHaveBeenCalled();
  });

  it('should handle save as errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockShowSaveDialog.mockResolvedValue('/test/path.arbo');
    mockSaveToPath.mockRejectedValue(new Error('Save failed'));

    renderHook(() => useTreeListeners(), { wrapper });

    const handleSaveAs = mockOnMenuSaveAs.mock.calls[0][0];
    await handleSaveAs();

    expect(consoleErrorSpy).toHaveBeenCalledWith('[FileSaveAs] Failed to save file: Save failed', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('should call moveUp on hotkey', () => {
    renderHook(() => useTreeListeners(), { wrapper });

    const handleMoveUp = mockRegister.mock.calls.find(
      (call) => call[0] === 'navigation.moveUp'
    )?.[1];

    handleMoveUp?.();

    expect(mockMoveUp).toHaveBeenCalled();
  });

  it('should call moveDown on hotkey', () => {
    renderHook(() => useTreeListeners(), { wrapper });

    const handleMoveDown = mockRegister.mock.calls.find(
      (call) => call[0] === 'navigation.moveDown'
    )?.[1];

    handleMoveDown?.();

    expect(mockMoveDown).toHaveBeenCalled();
  });
});
