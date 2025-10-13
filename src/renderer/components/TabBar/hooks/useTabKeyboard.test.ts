import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTabKeyboard } from './useTabKeyboard';
import { useTabsStore } from '../../../store/tabs/tabsStore';
import { storeManager } from '../../../store/storeManager';

vi.mock('../../../store/storeManager');

describe('useTabKeyboard', () => {
  const mockCloseActiveFile = vi.fn();
  const mockCloseFile = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset tabs store
    useTabsStore.setState({
      openFiles: [],
      activeFilePath: null,
    });

    // Mock store manager
    vi.mocked(storeManager.closeFile).mockImplementation(mockCloseFile);
  });

  it('should register keydown listener on mount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    renderHook(() => useTabKeyboard());

    expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should unregister keydown listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    const { unmount } = renderHook(() => useTabKeyboard());

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('should close active file when Ctrl+W is pressed', async () => {
    useTabsStore.setState({
      openFiles: [{ path: '/test/file.arbo', displayName: 'file.arbo' }],
      activeFilePath: '/test/file.arbo',
      closeActiveFile: mockCloseActiveFile,
    });

    renderHook(() => useTabKeyboard());

    const event = new KeyboardEvent('keydown', { key: 'w', ctrlKey: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    await window.dispatchEvent(event);

    // Wait for async handler
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(mockCloseFile).toHaveBeenCalledWith('/test/file.arbo');
    expect(mockCloseActiveFile).toHaveBeenCalledTimes(1);
  });

  it('should close active file when Cmd+W is pressed', async () => {
    useTabsStore.setState({
      openFiles: [{ path: '/test/file.arbo', displayName: 'file.arbo' }],
      activeFilePath: '/test/file.arbo',
      closeActiveFile: mockCloseActiveFile,
    });

    renderHook(() => useTabKeyboard());

    const event = new KeyboardEvent('keydown', { key: 'w', metaKey: true });
    const preventDefaultSpy = vi.spyOn(event, 'preventDefault');

    await window.dispatchEvent(event);

    // Wait for async handler
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(preventDefaultSpy).toHaveBeenCalled();
    expect(mockCloseFile).toHaveBeenCalledWith('/test/file.arbo');
    expect(mockCloseActiveFile).toHaveBeenCalledTimes(1);
  });

  it('should not close file when no active file', async () => {
    useTabsStore.setState({
      openFiles: [],
      activeFilePath: null,
      closeActiveFile: mockCloseActiveFile,
    });

    renderHook(() => useTabKeyboard());

    const event = new KeyboardEvent('keydown', { key: 'w', ctrlKey: true });
    await window.dispatchEvent(event);

    // Wait for async handler
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockCloseFile).not.toHaveBeenCalled();
    expect(mockCloseActiveFile).not.toHaveBeenCalled();
  });

  it('should not close file when Shift+Ctrl+W is pressed', async () => {
    useTabsStore.setState({
      openFiles: [{ path: '/test/file.arbo', displayName: 'file.arbo' }],
      activeFilePath: '/test/file.arbo',
      closeActiveFile: mockCloseActiveFile,
    });

    renderHook(() => useTabKeyboard());

    const event = new KeyboardEvent('keydown', { key: 'w', ctrlKey: true, shiftKey: true });
    await window.dispatchEvent(event);

    // Wait for async handler
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockCloseFile).not.toHaveBeenCalled();
    expect(mockCloseActiveFile).not.toHaveBeenCalled();
  });

  it('should re-register handler when activeFilePath changes', () => {
    const { rerender } = renderHook(() => useTabKeyboard());

    // Change active file
    useTabsStore.setState({
      openFiles: [
        { path: '/test/file1.arbo', displayName: 'file1.arbo' },
        { path: '/test/file2.arbo', displayName: 'file2.arbo' },
      ],
      activeFilePath: '/test/file2.arbo',
    });

    rerender();

    // Should still be listening
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
    expect(addEventListenerSpy).not.toHaveBeenCalled(); // No new listeners added
  });
});
