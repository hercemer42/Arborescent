import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useContextMenuBehavior } from '../useContextMenuBehavior';

describe('useContextMenuBehavior', () => {
  const mockOnClose = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return menuRef', () => {
    const { result } = renderHook(() => useContextMenuBehavior(mockOnClose));
    expect(result.current.menuRef).toBeDefined();
  });

  it('should initialize openSubmenu as null', () => {
    const { result } = renderHook(() => useContextMenuBehavior(mockOnClose));
    expect(result.current.openSubmenu).toBeNull();
  });

  it('should open submenu on click', () => {
    const { result } = renderHook(() => useContextMenuBehavior(mockOnClose));

    act(() => {
      result.current.handleItemClick({ label: 'Test', submenu: [] }, 2);
    });

    expect(result.current.openSubmenu).toBe(2);
  });

  it('should toggle submenu closed on second click', () => {
    const { result } = renderHook(() => useContextMenuBehavior(mockOnClose));

    act(() => {
      result.current.handleItemClick({ label: 'Test', submenu: [] }, 2);
    });
    expect(result.current.openSubmenu).toBe(2);

    act(() => {
      result.current.handleItemClick({ label: 'Test', submenu: [] }, 2);
    });
    expect(result.current.openSubmenu).toBeNull();
  });

  it('should switch submenu when clicking different item', () => {
    const { result } = renderHook(() => useContextMenuBehavior(mockOnClose));

    act(() => {
      result.current.handleItemClick({ label: 'Test', submenu: [] }, 1);
    });
    expect(result.current.openSubmenu).toBe(1);

    act(() => {
      result.current.handleItemClick({ label: 'Test 2', submenu: [] }, 3);
    });
    expect(result.current.openSubmenu).toBe(3);
  });

  it('should call onClose when handleItemClick is called with non-submenu item', () => {
    const { result } = renderHook(() => useContextMenuBehavior(mockOnClose));
    const mockItemClick = vi.fn();

    act(() => {
      result.current.handleItemClick({ label: 'Test', onClick: mockItemClick });
    });

    expect(mockItemClick).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not call onClose when handleItemClick is called with submenu item', () => {
    const { result } = renderHook(() => useContextMenuBehavior(mockOnClose));

    act(() => {
      result.current.handleItemClick({ label: 'Test', submenu: [] });
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should call onClose on Escape key', () => {
    renderHook(() => useContextMenuBehavior(mockOnClose));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not call onClose on other keys', () => {
    renderHook(() => useContextMenuBehavior(mockOnClose));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should call onClose on mousedown outside menu', () => {
    const { result } = renderHook(() => useContextMenuBehavior(mockOnClose));

    // Simulate menuRef not containing the target
    Object.defineProperty(result.current.menuRef, 'current', {
      value: {
        contains: () => false,
      },
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not call onClose on mousedown inside menu', () => {
    const { result } = renderHook(() => useContextMenuBehavior(mockOnClose));

    // Simulate menuRef containing the target
    Object.defineProperty(result.current.menuRef, 'current', {
      value: {
        contains: () => true,
      },
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should cleanup event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() => useContextMenuBehavior(mockOnClose));
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });
});
