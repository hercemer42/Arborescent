import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTerminalKeyboardShortcut } from '../useTerminalKeyboardShortcut';

describe('useTerminalKeyboardShortcut', () => {
  const mockOnToggle = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any event listeners
    vi.restoreAllMocks();
  });

  it('should call onToggle when Ctrl+` is pressed', () => {
    renderHook(() => useTerminalKeyboardShortcut(mockOnToggle));

    const event = new KeyboardEvent('keydown', {
      key: '`',
      ctrlKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });

  it('should call onToggle when Meta+` is pressed', () => {
    renderHook(() => useTerminalKeyboardShortcut(mockOnToggle));

    const event = new KeyboardEvent('keydown', {
      key: '`',
      metaKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(mockOnToggle).toHaveBeenCalledTimes(1);
  });

  it('should not call onToggle when only ` is pressed', () => {
    renderHook(() => useTerminalKeyboardShortcut(mockOnToggle));

    const event = new KeyboardEvent('keydown', {
      key: '`',
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(mockOnToggle).not.toHaveBeenCalled();
  });

  it('should not call onToggle when Shift+Ctrl+` is pressed', () => {
    renderHook(() => useTerminalKeyboardShortcut(mockOnToggle));

    const event = new KeyboardEvent('keydown', {
      key: '`',
      ctrlKey: true,
      shiftKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(mockOnToggle).not.toHaveBeenCalled();
  });

  it('should not call onToggle when Alt+Ctrl+` is pressed', () => {
    renderHook(() => useTerminalKeyboardShortcut(mockOnToggle));

    const event = new KeyboardEvent('keydown', {
      key: '`',
      ctrlKey: true,
      altKey: true,
      bubbles: true,
    });

    window.dispatchEvent(event);

    expect(mockOnToggle).not.toHaveBeenCalled();
  });

  it('should cleanup event listener on unmount', () => {
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderHook(() => useTerminalKeyboardShortcut(mockOnToggle));

    unmount();

    expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });
});
