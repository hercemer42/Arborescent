import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSubmenuPosition } from '../useSubmenuPosition';

describe('useSubmenuPosition', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: 1024, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 768, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
  });

  it('should not flip when submenu fits in viewport', () => {
    const submenuRef = {
      current: {
        getBoundingClientRect: () => ({
          right: 500,
          bottom: 400,
        }),
      } as HTMLDivElement,
    };

    const { result } = renderHook(() => useSubmenuPosition(submenuRef));

    expect(result.current.flipHorizontal).toBe(false);
    expect(result.current.flipVertical).toBe(false);
  });

  it('should flip horizontal when submenu overflows right edge', () => {
    const submenuRef = {
      current: {
        getBoundingClientRect: () => ({
          right: 1100, // Beyond viewport width of 1024
          bottom: 400,
        }),
      } as HTMLDivElement,
    };

    const { result } = renderHook(() => useSubmenuPosition(submenuRef));

    expect(result.current.flipHorizontal).toBe(true);
    expect(result.current.flipVertical).toBe(false);
  });

  it('should flip vertical when submenu overflows bottom edge', () => {
    const submenuRef = {
      current: {
        getBoundingClientRect: () => ({
          right: 500,
          bottom: 900, // Beyond viewport height of 768
        }),
      } as HTMLDivElement,
    };

    const { result } = renderHook(() => useSubmenuPosition(submenuRef));

    expect(result.current.flipHorizontal).toBe(false);
    expect(result.current.flipVertical).toBe(true);
  });

  it('should flip both directions when submenu overflows both edges', () => {
    const submenuRef = {
      current: {
        getBoundingClientRect: () => ({
          right: 1100,
          bottom: 900,
        }),
      } as HTMLDivElement,
    };

    const { result } = renderHook(() => useSubmenuPosition(submenuRef));

    expect(result.current.flipHorizontal).toBe(true);
    expect(result.current.flipVertical).toBe(true);
  });

  it('should return default values when ref is null', () => {
    const submenuRef = { current: null };

    const { result } = renderHook(() => useSubmenuPosition(submenuRef));

    expect(result.current.flipHorizontal).toBe(false);
    expect(result.current.flipVertical).toBe(false);
  });

  it('should detect overflow at exact boundary', () => {
    const submenuRef = {
      current: {
        getBoundingClientRect: () => ({
          right: 1025, // Just 1px over
          bottom: 769,  // Just 1px over
        }),
      } as HTMLDivElement,
    };

    const { result } = renderHook(() => useSubmenuPosition(submenuRef));

    expect(result.current.flipHorizontal).toBe(true);
    expect(result.current.flipVertical).toBe(true);
  });

  it('should not flip when at exact boundary', () => {
    const submenuRef = {
      current: {
        getBoundingClientRect: () => ({
          right: 1024, // Exactly at edge
          bottom: 768,  // Exactly at edge
        }),
      } as HTMLDivElement,
    };

    const { result } = renderHook(() => useSubmenuPosition(submenuRef));

    expect(result.current.flipHorizontal).toBe(false);
    expect(result.current.flipVertical).toBe(false);
  });
});
