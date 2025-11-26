import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIconPickerBehavior } from '../useIconPickerBehavior';

describe('useIconPickerBehavior', () => {
  const mockOnSelect = vi.fn();
  const mockOnClose = vi.fn();

  const mockAllIcons = [
    { icon: {} as never, name: 'apple' },
    { icon: {} as never, name: 'banana' },
    { icon: {} as never, name: 'cherry' },
    { icon: {} as never, name: 'star' },
    { icon: {} as never, name: 'heart' },
  ];

  const mockCuratedIcons = [
    { icon: {} as never, name: 'star' },
    { icon: {} as never, name: 'heart' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should return refs', () => {
    const { result } = renderHook(() =>
      useIconPickerBehavior(mockOnSelect, mockOnClose, mockAllIcons, mockCuratedIcons)
    );

    expect(result.current.dialogRef).toBeDefined();
    expect(result.current.searchInputRef).toBeDefined();
  });

  it('should initialize with curated icons', () => {
    const { result } = renderHook(() =>
      useIconPickerBehavior(mockOnSelect, mockOnClose, mockAllIcons, mockCuratedIcons)
    );

    expect(result.current.displayedIcons).toEqual(mockCuratedIcons);
    expect(result.current.showAll).toBe(false);
  });

  it('should show all icons after handleShowMore', () => {
    const { result } = renderHook(() =>
      useIconPickerBehavior(mockOnSelect, mockOnClose, mockAllIcons, mockCuratedIcons)
    );

    act(() => {
      result.current.handleShowMore();
    });

    expect(result.current.displayedIcons).toEqual(mockAllIcons);
    expect(result.current.showAll).toBe(true);
  });

  it('should show curated icons after handleShowLess', () => {
    const { result } = renderHook(() =>
      useIconPickerBehavior(mockOnSelect, mockOnClose, mockAllIcons, mockCuratedIcons)
    );

    act(() => {
      result.current.handleShowMore();
    });
    expect(result.current.showAll).toBe(true);

    act(() => {
      result.current.handleShowLess();
    });

    expect(result.current.displayedIcons).toEqual(mockCuratedIcons);
    expect(result.current.showAll).toBe(false);
  });

  it('should filter icons by search query', () => {
    const { result } = renderHook(() =>
      useIconPickerBehavior(mockOnSelect, mockOnClose, mockAllIcons, mockCuratedIcons)
    );

    act(() => {
      result.current.handleSearchChange('app');
    });

    expect(result.current.displayedIcons).toEqual([{ icon: {} as never, name: 'apple' }]);
    expect(result.current.isSearching).toBe(true);
  });

  it('should search all icons regardless of showAll state', () => {
    const { result } = renderHook(() =>
      useIconPickerBehavior(mockOnSelect, mockOnClose, mockAllIcons, mockCuratedIcons)
    );

    // Start with curated icons (showAll = false)
    expect(result.current.showAll).toBe(false);

    act(() => {
      result.current.handleSearchChange('ban');
    });

    // Should find 'banana' even though it's not in curated icons
    expect(result.current.displayedIcons).toEqual([{ icon: {} as never, name: 'banana' }]);
  });

  it('should clear search query on handleShowMore', () => {
    const { result } = renderHook(() =>
      useIconPickerBehavior(mockOnSelect, mockOnClose, mockAllIcons, mockCuratedIcons)
    );

    act(() => {
      result.current.handleSearchChange('test');
    });
    expect(result.current.searchQuery).toBe('test');

    act(() => {
      result.current.handleShowMore();
    });
    expect(result.current.searchQuery).toBe('');
  });

  it('should clear search query on handleShowLess', () => {
    const { result } = renderHook(() =>
      useIconPickerBehavior(mockOnSelect, mockOnClose, mockAllIcons, mockCuratedIcons)
    );

    act(() => {
      result.current.handleSearchChange('test');
    });

    act(() => {
      result.current.handleShowLess();
    });
    expect(result.current.searchQuery).toBe('');
  });

  it('should call onSelect and onClose on handleIconClick', () => {
    const { result } = renderHook(() =>
      useIconPickerBehavior(mockOnSelect, mockOnClose, mockAllIcons, mockCuratedIcons)
    );

    act(() => {
      result.current.handleIconClick('star');
    });

    expect(mockOnSelect).toHaveBeenCalledWith('star');
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should set hoveredIcon on handleIconHover', () => {
    const { result } = renderHook(() =>
      useIconPickerBehavior(mockOnSelect, mockOnClose, mockAllIcons, mockCuratedIcons)
    );

    expect(result.current.hoveredIcon).toBeNull();

    act(() => {
      result.current.handleIconHover('star');
    });
    expect(result.current.hoveredIcon).toBe('star');

    act(() => {
      result.current.handleIconHover(null);
    });
    expect(result.current.hoveredIcon).toBeNull();
  });

  it('should call onClose on Escape key', () => {
    renderHook(() =>
      useIconPickerBehavior(mockOnSelect, mockOnClose, mockAllIcons, mockCuratedIcons)
    );

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should call onClose on mousedown outside dialog', () => {
    const { result } = renderHook(() =>
      useIconPickerBehavior(mockOnSelect, mockOnClose, mockAllIcons, mockCuratedIcons)
    );

    Object.defineProperty(result.current.dialogRef, 'current', {
      value: { contains: () => false },
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('should not call onClose on mousedown inside dialog', () => {
    const { result } = renderHook(() =>
      useIconPickerBehavior(mockOnSelect, mockOnClose, mockAllIcons, mockCuratedIcons)
    );

    Object.defineProperty(result.current.dialogRef, 'current', {
      value: { contains: () => true },
    });

    act(() => {
      document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(mockOnClose).not.toHaveBeenCalled();
  });

  it('should cleanup event listeners on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

    const { unmount } = renderHook(() =>
      useIconPickerBehavior(mockOnSelect, mockOnClose, mockAllIcons, mockCuratedIcons)
    );
    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('mousedown', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));

    removeEventListenerSpy.mockRestore();
  });
});
