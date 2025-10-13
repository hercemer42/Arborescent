import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTreeMenu } from './useTreeMenu';
import { ElectronMenuService } from '@platform/menu';

vi.mock('@platform/menu');

describe('useTreeMenu', () => {
  const mockOnMenuOpen = vi.fn();
  const mockOnMenuSave = vi.fn();
  const mockOnMenuSaveAs = vi.fn();
  const mockHandleLoad = vi.fn();
  const mockHandleSave = vi.fn();
  const mockHandleSaveAs = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock menu service
    vi.mocked(ElectronMenuService.prototype.onMenuOpen).mockImplementation(mockOnMenuOpen);
    vi.mocked(ElectronMenuService.prototype.onMenuSave).mockImplementation(mockOnMenuSave);
    vi.mocked(ElectronMenuService.prototype.onMenuSaveAs).mockImplementation(mockOnMenuSaveAs);
  });

  it('should register menu open listener', () => {
    renderHook(() => useTreeMenu({
      handleLoad: mockHandleLoad,
      handleSave: mockHandleSave,
      handleSaveAs: mockHandleSaveAs,
    }));

    expect(mockOnMenuOpen).toHaveBeenCalledWith(mockHandleLoad);
  });

  it('should register menu save listener', () => {
    renderHook(() => useTreeMenu({
      handleLoad: mockHandleLoad,
      handleSave: mockHandleSave,
      handleSaveAs: mockHandleSaveAs,
    }));

    expect(mockOnMenuSave).toHaveBeenCalledWith(mockHandleSave);
  });

  it('should register menu save as listener', () => {
    renderHook(() => useTreeMenu({
      handleLoad: mockHandleLoad,
      handleSave: mockHandleSave,
      handleSaveAs: mockHandleSaveAs,
    }));

    expect(mockOnMenuSaveAs).toHaveBeenCalledWith(mockHandleSaveAs);
  });

  it('should re-register listeners when handlers change', () => {
    const { rerender } = renderHook(
      ({ handlers }) => useTreeMenu(handlers),
      {
        initialProps: {
          handlers: {
            handleLoad: mockHandleLoad,
            handleSave: mockHandleSave,
            handleSaveAs: mockHandleSaveAs,
          }
        }
      }
    );

    expect(mockOnMenuOpen).toHaveBeenCalledTimes(1);
    expect(mockOnMenuSave).toHaveBeenCalledTimes(1);
    expect(mockOnMenuSaveAs).toHaveBeenCalledTimes(1);

    // Change handlers
    const newHandleLoad = vi.fn();
    const newHandleSave = vi.fn();
    const newHandleSaveAs = vi.fn();

    rerender({
      handlers: {
        handleLoad: newHandleLoad,
        handleSave: newHandleSave,
        handleSaveAs: newHandleSaveAs,
      }
    });

    expect(mockOnMenuOpen).toHaveBeenCalledTimes(2);
    expect(mockOnMenuSave).toHaveBeenCalledTimes(2);
    expect(mockOnMenuSaveAs).toHaveBeenCalledTimes(2);
    expect(mockOnMenuOpen).toHaveBeenLastCalledWith(newHandleLoad);
    expect(mockOnMenuSave).toHaveBeenLastCalledWith(newHandleSave);
    expect(mockOnMenuSaveAs).toHaveBeenLastCalledWith(newHandleSaveAs);
  });
});
