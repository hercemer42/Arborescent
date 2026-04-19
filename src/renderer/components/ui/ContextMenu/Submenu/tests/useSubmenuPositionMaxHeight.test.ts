import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useSubmenuPosition } from '../useSubmenuPosition';

// Viewport-fit contract: a tall submenu must not extend past the top or
// bottom of the viewport. When neither direction can fully contain the
// submenu, the hook chooses whichever has more room and caps maxHeight to
// that space so overflow-y: auto can take over and scroll the rest.

describe('useSubmenuPosition — maxHeight clamp to avoid top/bottom clip', () => {
  const originalInnerWidth = window.innerWidth;
  const originalInnerHeight = window.innerHeight;
  const VIEWPORT_HEIGHT = 768;
  const VIEWPORT_WIDTH = 1024;

  beforeEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_WIDTH, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: VIEWPORT_HEIGHT, writable: true });
  });

  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { value: originalInnerWidth, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: originalInnerHeight, writable: true });
  });

  function makeRef(opts: {
    submenu: { top: number; right: number; bottom: number };
    parent?: { top: number; right: number; bottom: number };
  }) {
    return {
      current: {
        getBoundingClientRect: () => opts.submenu,
        parentElement: opts.parent
          ? ({
              getBoundingClientRect: () => opts.parent,
            } as unknown as HTMLElement)
          : null,
      } as unknown as HTMLDivElement,
    };
  }

  it('leaves maxHeight undefined when the submenu fits naturally below with no overflow', () => {
    const ref = makeRef({
      submenu: { top: 100, right: 500, bottom: 400 },
      parent: { top: 100, right: 200, bottom: 130 },
    });

    const { result } = renderHook(() => useSubmenuPosition(ref));

    expect(result.current.flipVertical).toBe(false);
    expect(result.current.maxHeight).toBeUndefined();
  });

  it('caps maxHeight to the space above when flipping vertically with a submenu too tall for either direction', () => {
    // Parent item near the BOTTOM of the viewport (top=600, bottom=630).
    // space-above = 600, space-below = 138. A tall submenu (700px) does
    // not fit in either direction, so the hook should flip (more space
    // above) and cap maxHeight to the available space above.
    const ref = makeRef({
      submenu: { top: 630, right: 500, bottom: 1330 },
      parent: { top: 600, right: 200, bottom: 630 },
    });

    const { result } = renderHook(() => useSubmenuPosition(ref));

    const spaceAbove = 600;
    expect(result.current.flipVertical).toBe(true);
    expect(result.current.maxHeight).toBeDefined();
    expect(result.current.maxHeight).toBeLessThanOrEqual(spaceAbove);
    expect(result.current.maxHeight).toBeGreaterThan(0);
  });

  it('caps maxHeight to the space below when opening down with a tall submenu that would overflow', () => {
    // Parent item near the top of the viewport, plenty of space below.
    // Submenu is taller than available space → open down but clamp height.
    const ref = makeRef({
      submenu: { top: 50, right: 500, bottom: 900 },
      parent: { top: 50, right: 200, bottom: 80 },
    });

    const { result } = renderHook(() => useSubmenuPosition(ref));

    // Space below parent = viewport - parent.bottom = 768 - 80 = 688
    // Space above parent = parent.top = 50
    // Since space-below > space-above, prefer open-down (do not flip)
    expect(result.current.flipVertical).toBe(false);
    expect(result.current.maxHeight).toBeDefined();
    expect(result.current.maxHeight).toBeLessThanOrEqual(VIEWPORT_HEIGHT - 80);
  });

  it('chooses the direction with more vertical space when neither direction can fully contain the submenu', () => {
    // Parent slightly below viewport midpoint so spaceAbove > spaceBelow.
    // Submenu is very tall (800px) so it cannot fit in either direction.
    // Hook should flip (more space above) and cap maxHeight to spaceAbove.
    const ref = makeRef({
      submenu: { top: 500, right: 500, bottom: 1300 },
      parent: { top: 500, right: 200, bottom: 530 },
    });

    const { result } = renderHook(() => useSubmenuPosition(ref));

    const spaceAbove = 500;
    const spaceBelow = VIEWPORT_HEIGHT - 530; // 238

    expect(result.current.flipVertical).toBe(true);
    expect(result.current.maxHeight).toBeDefined();
    expect(result.current.maxHeight).toBeLessThanOrEqual(spaceAbove);
    expect(result.current.maxHeight).toBeGreaterThan(spaceBelow);
  });

  it('leaves maxHeight undefined and does not flip when space below comfortably contains the submenu', () => {
    // Explicitly asserts the "no-op" case to guard against over-eager clamping.
    const ref = makeRef({
      submenu: { top: 100, right: 500, bottom: 500 },
      parent: { top: 100, right: 200, bottom: 130 },
    });

    const { result } = renderHook(() => useSubmenuPosition(ref));

    expect(result.current.flipVertical).toBe(false);
    expect(result.current.flipHorizontal).toBe(false);
    expect(result.current.maxHeight).toBeUndefined();
  });

  it('returns default values and does not explode when submenuRef is null');
  it('falls back gracefully when parentElement is null (no parent rect available)');

  it('does not regress the existing horizontal-flip behavior when the submenu overflows the right edge', () => {
    // Sanity check that maxHeight work does not interfere with the existing
    // flipHorizontal detection.
    const ref = makeRef({
      submenu: { top: 100, right: 1100, bottom: 400 },
      parent: { top: 100, right: 200, bottom: 130 },
    });

    const { result } = renderHook(() => useSubmenuPosition(ref));

    expect(result.current.flipHorizontal).toBe(true);
  });
});
