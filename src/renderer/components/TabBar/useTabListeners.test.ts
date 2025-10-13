import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTabListeners } from './useTabListeners';
import { useTabsStore } from '../../store/tabs/tabsStore';
import { storeManager } from '../../store/storeManager';
import { hotkeyService } from '../../services/hotkeyService';

vi.mock('../../services/hotkeyService');
vi.mock('../../store/storeManager');

describe('useTabListeners', () => {
  const mockCloseActiveFile = vi.fn();
  const mockRegister = vi.fn();
  const mockUnregister = vi.fn();
  const mockCloseFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset tabs store
    useTabsStore.setState({
      openFiles: [],
      activeFilePath: null,
    });

    // Mock hotkey service
    mockRegister.mockReturnValue(mockUnregister);
    vi.mocked(hotkeyService.register).mockImplementation(mockRegister);

    // Mock store manager
    vi.mocked(storeManager.closeFile).mockImplementation(mockCloseFile);
  });

  it('should register closeTab hotkey on mount', () => {
    renderHook(() => useTabListeners());

    expect(mockRegister).toHaveBeenCalledWith('file.closeTab', expect.any(Function));
  });

  it('should unregister closeTab hotkey on unmount', () => {
    const { unmount } = renderHook(() => useTabListeners());

    expect(mockUnregister).not.toHaveBeenCalled();

    unmount();

    expect(mockUnregister).toHaveBeenCalledTimes(1);
  });

  it('should close active file when hotkey is triggered', async () => {
    useTabsStore.setState({
      openFiles: [{ path: '/test/file.arbo', displayName: 'file.arbo' }],
      activeFilePath: '/test/file.arbo',
      closeActiveFile: mockCloseActiveFile,
    });

    renderHook(() => useTabListeners());

    // Get the registered handler
    const handleCloseTab = mockRegister.mock.calls[0][1];

    // Trigger the handler
    await handleCloseTab();

    expect(mockCloseFile).toHaveBeenCalledWith('/test/file.arbo');
    expect(mockCloseActiveFile).toHaveBeenCalledTimes(1);
  });

  it('should not close file when no active file', async () => {
    useTabsStore.setState({
      openFiles: [],
      activeFilePath: null,
      closeActiveFile: mockCloseActiveFile,
    });

    renderHook(() => useTabListeners());

    // Get the registered handler
    const handleCloseTab = mockRegister.mock.calls[0][1];

    // Trigger the handler
    await handleCloseTab();

    expect(mockCloseFile).not.toHaveBeenCalled();
    expect(mockCloseActiveFile).not.toHaveBeenCalled();
  });

  it('should save file before closing via storeManager', async () => {
    const mockSave = vi.fn().mockResolvedValue(undefined);
    mockCloseFile.mockImplementation(mockSave);

    useTabsStore.setState({
      openFiles: [{ path: '/test/file.arbo', displayName: 'file.arbo' }],
      activeFilePath: '/test/file.arbo',
      closeActiveFile: mockCloseActiveFile,
    });

    renderHook(() => useTabListeners());

    const handleCloseTab = mockRegister.mock.calls[0][1];
    await handleCloseTab();

    expect(mockSave).toHaveBeenCalledWith('/test/file.arbo');
    expect(mockCloseActiveFile).toHaveBeenCalledTimes(1);
  });

  it('should re-register handler when activeFilePath changes', () => {
    const { rerender } = renderHook(() => useTabListeners());

    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockUnregister).toHaveBeenCalledTimes(0);

    // Change active file
    useTabsStore.setState({
      openFiles: [
        { path: '/test/file1.arbo', displayName: 'file1.arbo' },
        { path: '/test/file2.arbo', displayName: 'file2.arbo' },
      ],
      activeFilePath: '/test/file2.arbo',
    });

    rerender();

    // Should unregister old and register new
    expect(mockUnregister).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenCalledTimes(2);
  });

  it('should propagate errors when closing file fails', async () => {
    mockCloseFile.mockRejectedValue(new Error('Failed to save'));

    useTabsStore.setState({
      openFiles: [{ path: '/test/file.arbo', displayName: 'file.arbo' }],
      activeFilePath: '/test/file.arbo',
      closeActiveFile: mockCloseActiveFile,
    });

    renderHook(() => useTabListeners());

    const handleCloseTab = mockRegister.mock.calls[0][1];

    // Error should propagate, closeActiveFile should not be called
    await expect(handleCloseTab()).rejects.toThrow('Failed to save');
    expect(mockCloseActiveFile).not.toHaveBeenCalled();
  });
});
