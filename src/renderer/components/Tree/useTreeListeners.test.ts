import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTreeListeners } from './useTreeListeners';
import { useTreeStore } from '../../store/treeStore';
import { hotkeyService } from '../../services/hotkeyService';

vi.mock('../../services/hotkeyService');

describe('useTreeListeners', () => {
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

    useTreeStore.setState({
      nodes: {},
      rootNodeId: '',
      nodeTypeConfig: {},
      selectedNodeId: null,
      cursorPosition: 0,
      rememberedCursorColumn: null,
      actions: {
        loadFromPath: mockLoadFromPath,
        saveToPath: mockSaveToPath,
        moveUp: mockMoveUp,
        moveDown: mockMoveDown,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    });

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

  it('should register menu listeners on mount', () => {
    renderHook(() => useTreeListeners());

    expect(mockOnMenuOpen).toHaveBeenCalled();
    expect(mockOnMenuSave).toHaveBeenCalled();
    expect(mockOnMenuSaveAs).toHaveBeenCalled();
  });

  it('should register hotkey listeners on mount', () => {
    renderHook(() => useTreeListeners());

    expect(mockRegister).toHaveBeenCalledWith('navigation.moveUp', expect.any(Function));
    expect(mockRegister).toHaveBeenCalledWith('navigation.moveDown', expect.any(Function));
  });

  it('should register keydown listener on mount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useTreeListeners());

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should unregister listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useTreeListeners());
    unmount();

    expect(mockUnregister).toHaveBeenCalledTimes(2);
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should handle load operation', async () => {
    const mockMeta = { created: '2025-01-01', author: 'Test' };
    mockShowOpenDialog.mockResolvedValue('/test/path.arbo');
    mockLoadFromPath.mockResolvedValue(mockMeta);

    renderHook(() => useTreeListeners());

    const handleLoad = mockOnMenuOpen.mock.calls[0][0];
    await handleLoad();

    expect(mockShowOpenDialog).toHaveBeenCalled();
    expect(mockLoadFromPath).toHaveBeenCalledWith('/test/path.arbo');
  });

  it('should not load when dialog is cancelled', async () => {
    mockShowOpenDialog.mockResolvedValue(null);

    renderHook(() => useTreeListeners());

    const handleLoad = mockOnMenuOpen.mock.calls[0][0];
    await handleLoad();

    expect(mockShowOpenDialog).toHaveBeenCalled();
    expect(mockLoadFromPath).not.toHaveBeenCalled();
  });

  it('should handle load errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockShowOpenDialog.mockResolvedValue('/test/path.arbo');
    mockLoadFromPath.mockRejectedValue(new Error('Load failed'));

    renderHook(() => useTreeListeners());

    const handleLoad = mockOnMenuOpen.mock.calls[0][0];
    await handleLoad();

    expect(consoleErrorSpy).toHaveBeenCalledWith('[FileLoad] Failed to load file: Load failed', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });


  it('should handle save operation without existing path', async () => {
    mockShowSaveDialog.mockResolvedValue('/test/new.arbo');
    mockSaveToPath.mockResolvedValue(undefined);

    renderHook(() => useTreeListeners());

    const handleSave = mockOnMenuSave.mock.calls[0][0];
    await handleSave();

    expect(mockShowSaveDialog).toHaveBeenCalled();
    expect(mockSaveToPath).toHaveBeenCalledWith('/test/new.arbo', undefined);
  });

  it('should not save when dialog is cancelled', async () => {
    mockShowSaveDialog.mockResolvedValue(null);

    renderHook(() => useTreeListeners());

    const handleSave = mockOnMenuSave.mock.calls[0][0];
    await handleSave();

    expect(mockShowSaveDialog).toHaveBeenCalled();
    expect(mockSaveToPath).not.toHaveBeenCalled();
  });

  it('should handle save errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockShowSaveDialog.mockResolvedValue('/test/path.arbo');
    mockSaveToPath.mockRejectedValue(new Error('Save failed'));

    renderHook(() => useTreeListeners());

    const handleSave = mockOnMenuSave.mock.calls[0][0];
    await handleSave();

    expect(consoleErrorSpy).toHaveBeenCalledWith('[FileSave] Failed to save file: Save failed', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('should handle save as operation', async () => {
    mockShowSaveDialog.mockResolvedValue('/test/saveas.arbo');
    mockSaveToPath.mockResolvedValue(undefined);

    renderHook(() => useTreeListeners());

    const handleSaveAs = mockOnMenuSaveAs.mock.calls[0][0];
    await handleSaveAs();

    expect(mockShowSaveDialog).toHaveBeenCalled();
    expect(mockSaveToPath).toHaveBeenCalledWith('/test/saveas.arbo', undefined);
  });

  it('should not save as when dialog is cancelled', async () => {
    mockShowSaveDialog.mockResolvedValue(null);

    renderHook(() => useTreeListeners());

    const handleSaveAs = mockOnMenuSaveAs.mock.calls[0][0];
    await handleSaveAs();

    expect(mockShowSaveDialog).toHaveBeenCalled();
    expect(mockSaveToPath).not.toHaveBeenCalled();
  });

  it('should handle save as errors', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockShowSaveDialog.mockResolvedValue('/test/path.arbo');
    mockSaveToPath.mockRejectedValue(new Error('Save failed'));

    renderHook(() => useTreeListeners());

    const handleSaveAs = mockOnMenuSaveAs.mock.calls[0][0];
    await handleSaveAs();

    expect(consoleErrorSpy).toHaveBeenCalledWith('[FileSaveAs] Failed to save file: Save failed', expect.any(Error));
    consoleErrorSpy.mockRestore();
  });

  it('should call moveUp on hotkey', () => {
    renderHook(() => useTreeListeners());

    const handleMoveUp = mockRegister.mock.calls.find(
      (call) => call[0] === 'navigation.moveUp'
    )?.[1];

    handleMoveUp?.();

    expect(mockMoveUp).toHaveBeenCalled();
  });

  it('should call moveDown on hotkey', () => {
    renderHook(() => useTreeListeners());

    const handleMoveDown = mockRegister.mock.calls.find(
      (call) => call[0] === 'navigation.moveDown'
    )?.[1];

    handleMoveDown?.();

    expect(mockMoveDown).toHaveBeenCalled();
  });
});
