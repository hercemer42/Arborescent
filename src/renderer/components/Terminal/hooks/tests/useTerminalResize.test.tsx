import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTerminalResize } from '../useTerminalResize';
import { RefObject } from 'react';

describe('useTerminalResize', () => {
  let mockContentRef: RefObject<HTMLDivElement>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Create mock element with getBoundingClientRect
    const mockDiv = document.createElement('div');
    Object.defineProperty(mockDiv, 'getBoundingClientRect', {
      value: vi.fn(() => ({
        bottom: 600,
        right: 800,
        height: 800,
        width: 1200,
        top: 0,
        left: 0,
        x: 0,
        y: 0,
        toJSON: () => ({}),
      })),
    });

    mockContentRef = {
      current: mockDiv,
    };
  });

  it('should return initial terminal dimensions for bottom panel', () => {
    const { result } = renderHook(() =>
      useTerminalResize({
        contentRef: mockContentRef,
        panelPosition: 'bottom',
        initialHeight: 400,
      })
    );

    expect(result.current.terminalHeight).toBe(400);
    expect(result.current.isResizing).toBe(false);
    expect(result.current.handleMouseDown).toBeInstanceOf(Function);
  });

  it('should return initial terminal dimensions for side panel', () => {
    const { result } = renderHook(() =>
      useTerminalResize({
        contentRef: mockContentRef,
        panelPosition: 'side',
        initialWidth: 500,
      })
    );

    expect(result.current.terminalWidth).toBe(500);
    expect(result.current.isResizing).toBe(false);
    expect(result.current.handleMouseDown).toBeInstanceOf(Function);
  });

  it('should set isResizing to true when handleMouseDown is called', () => {
    const { result } = renderHook(() =>
      useTerminalResize({
        contentRef: mockContentRef,
        panelPosition: 'bottom',
      })
    );

    const mockMouseEvent = new MouseEvent('mousedown');

    act(() => {
      result.current.handleMouseDown(mockMouseEvent as unknown as React.MouseEvent);
    });

    expect(result.current.isResizing).toBe(true);
  });

  it('should set isResizing state during drag', () => {
    const { result } = renderHook(() =>
      useTerminalResize({
        contentRef: mockContentRef,
        panelPosition: 'bottom',
        initialHeight: 300,
      })
    );

    // Start resizing
    act(() => {
      result.current.handleMouseDown(
        new MouseEvent('mousedown', { clientY: 500 }) as unknown as React.MouseEvent
      );
    });

    expect(result.current.isResizing).toBe(true);
  });

  it('should respect minimum height for bottom panel', () => {
    const { result } = renderHook(() =>
      useTerminalResize({
        contentRef: mockContentRef,
        panelPosition: 'bottom',
        initialHeight: 300,
      })
    );

    // Start resizing
    act(() => {
      result.current.handleMouseDown(
        new MouseEvent('mousedown', { clientY: 100 }) as unknown as React.MouseEvent
      );
    });

    // Simulate dragging far down (trying to make height tiny)
    act(() => {
      const moveEvent = new MouseEvent('mousemove', { clientY: 5000 });
      window.dispatchEvent(moveEvent);
    });

    // Should respect minimum of 100px
    expect(result.current.terminalHeight).toBeGreaterThanOrEqual(100);
  });

  it('should handle mouse down event', () => {
    const { result } = renderHook(() =>
      useTerminalResize({
        contentRef: mockContentRef,
        panelPosition: 'bottom',
      })
    );

    const initialResizing = result.current.isResizing;
    expect(initialResizing).toBe(false);

    // Start resizing
    act(() => {
      result.current.handleMouseDown(
        new MouseEvent('mousedown') as unknown as React.MouseEvent
      );
    });

    expect(result.current.isResizing).toBe(true);
  });

  it('should return handleMouseDown function', () => {
    const { result } = renderHook(() =>
      useTerminalResize({
        contentRef: mockContentRef,
        panelPosition: 'bottom',
      })
    );

    expect(result.current.handleMouseDown).toBeInstanceOf(Function);
    expect(result.current.terminalHeight).toBeDefined();
    expect(result.current.isResizing).toBeDefined();
  });

  it('should handle resize for side panel', () => {
    const { result } = renderHook(() =>
      useTerminalResize({
        contentRef: mockContentRef,
        panelPosition: 'side',
        initialWidth: 400,
      })
    );

    expect(result.current.terminalWidth).toBe(400);

    // Start resizing
    act(() => {
      result.current.handleMouseDown(
        new MouseEvent('mousedown', { clientX: 700 }) as unknown as React.MouseEvent
      );
    });

    expect(result.current.isResizing).toBe(true);

    // Simulate mouse move for side panel
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 650 }));
    });

    // Should update width
    expect(result.current.terminalWidth).toBeGreaterThan(0);

    // Stop resizing
    act(() => {
      document.dispatchEvent(new MouseEvent('mouseup'));
    });

    expect(result.current.isResizing).toBe(false);
  });

  it('should handle resize with contentRef.current being null', () => {
    const nullRef = { current: null } as unknown as RefObject<HTMLDivElement>;

    const { result } = renderHook(() =>
      useTerminalResize({
        contentRef: nullRef,
        panelPosition: 'bottom',
      })
    );

    // Start resizing
    act(() => {
      result.current.handleMouseDown(
        new MouseEvent('mousedown') as unknown as React.MouseEvent
      );
    });

    // Dispatch mousemove when ref is null - should handle gracefully
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientY: 400 }));
    });

    // Should not crash
    expect(result.current.isResizing).toBe(true);
  });

  it('should respect maximum height for bottom panel', () => {
    const { result } = renderHook(() =>
      useTerminalResize({
        contentRef: mockContentRef,
        panelPosition: 'bottom',
        initialHeight: 300,
      })
    );

    // Start resizing
    act(() => {
      result.current.handleMouseDown(
        new MouseEvent('mousedown', { clientY: 500 }) as unknown as React.MouseEvent
      );
    });

    // Try to drag to make terminal very tall (beyond max)
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientY: -1000 }));
    });

    // Should respect max ratio (0.8 * 800 = 640)
    expect(result.current.terminalHeight).toBeLessThanOrEqual(640);
  });

  it('should respect minimum width for side panel', () => {
    const { result } = renderHook(() =>
      useTerminalResize({
        contentRef: mockContentRef,
        panelPosition: 'side',
        initialWidth: 300,
      })
    );

    // Start resizing
    act(() => {
      result.current.handleMouseDown(
        new MouseEvent('mousedown', { clientX: 700 }) as unknown as React.MouseEvent
      );
    });

    // Try to drag to make terminal very narrow
    act(() => {
      document.dispatchEvent(new MouseEvent('mousemove', { clientX: 2000 }));
    });

    // Should respect minimum of 200px
    expect(result.current.terminalWidth).toBeGreaterThanOrEqual(200);
  });
});
