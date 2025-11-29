import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useMenuPosition } from '../useMenuPosition';

describe('useMenuPosition', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    // Set viewport size
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
  });

  it('should return initial position when menu fits in viewport', () => {
    const menuRef = {
      current: {
        getBoundingClientRect: () => ({
          width: 200,
          height: 300,
          top: 100,
          left: 100,
          right: 300,
          bottom: 400,
        }),
      } as HTMLDivElement,
    };

    const { result } = renderHook(() => useMenuPosition(menuRef, 100, 100));

    expect(result.current.x).toBe(100);
    expect(result.current.y).toBe(100);
  });

  it('should adjust x when menu would overflow right edge', () => {
    const menuRef = {
      current: {
        getBoundingClientRect: () => ({
          width: 200,
          height: 300,
          top: 100,
          left: 900,
          right: 1100,
          bottom: 400,
        }),
      } as HTMLDivElement,
    };

    const { result } = renderHook(() => useMenuPosition(menuRef, 900, 100));

    // Should be adjusted to fit: 1024 - 200 - 8 = 816
    expect(result.current.x).toBe(816);
    expect(result.current.y).toBe(100);
  });

  it('should adjust y when menu would overflow bottom edge', () => {
    const menuRef = {
      current: {
        getBoundingClientRect: () => ({
          width: 200,
          height: 300,
          top: 600,
          left: 100,
          right: 300,
          bottom: 900,
        }),
      } as HTMLDivElement,
    };

    const { result } = renderHook(() => useMenuPosition(menuRef, 100, 600));

    // Should be adjusted to fit: 768 - 300 - 8 = 460
    expect(result.current.x).toBe(100);
    expect(result.current.y).toBe(460);
  });

  it('should adjust both x and y when menu would overflow both edges', () => {
    const menuRef = {
      current: {
        getBoundingClientRect: () => ({
          width: 200,
          height: 300,
          top: 600,
          left: 900,
          right: 1100,
          bottom: 900,
        }),
      } as HTMLDivElement,
    };

    const { result } = renderHook(() => useMenuPosition(menuRef, 900, 600));

    expect(result.current.x).toBe(816); // 1024 - 200 - 8
    expect(result.current.y).toBe(460); // 768 - 300 - 8
  });

  it('should ensure minimum margin from left edge', () => {
    const menuRef = {
      current: {
        getBoundingClientRect: () => ({
          width: 200,
          height: 300,
          top: 100,
          left: -50,
          right: 150,
          bottom: 400,
        }),
      } as HTMLDivElement,
    };

    const { result } = renderHook(() => useMenuPosition(menuRef, -50, 100));

    expect(result.current.x).toBe(8); // Minimum margin
    expect(result.current.y).toBe(100);
  });

  it('should ensure minimum margin from top edge', () => {
    const menuRef = {
      current: {
        getBoundingClientRect: () => ({
          width: 200,
          height: 300,
          top: -50,
          left: 100,
          right: 300,
          bottom: 250,
        }),
      } as HTMLDivElement,
    };

    const { result } = renderHook(() => useMenuPosition(menuRef, 100, -50));

    expect(result.current.x).toBe(100);
    expect(result.current.y).toBe(8); // Minimum margin
  });

  it('should return initial position when ref is null', () => {
    const menuRef = { current: null };

    const { result } = renderHook(() => useMenuPosition(menuRef, 100, 200));

    expect(result.current.x).toBe(100);
    expect(result.current.y).toBe(200);
  });
});
