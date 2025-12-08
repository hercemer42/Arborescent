import { RefObject, useState, useLayoutEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

interface MenuPosition extends Position {
  measured: boolean;
}

/**
 * Hook that adjusts menu position to keep it within viewport boundaries.
 * Uses useLayoutEffect to measure and reposition before paint.
 * Returns measured: false until position has been calculated to prevent flash.
 */
export function useMenuPosition(
  menuRef: RefObject<HTMLDivElement | null>,
  initialX: number,
  initialY: number
): MenuPosition {
  const [position, setPosition] = useState<MenuPosition>({ x: initialX, y: initialY, measured: false });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      setPosition({ x: initialX, y: initialY, measured: false });
      return;
    }

    const rect = menu.getBoundingClientRect();
    const menuWidth = rect.width;
    // Use scrollHeight for accurate measurement in case menu is partially clipped
    const menuHeight = Math.max(rect.height, menu.scrollHeight || 0);
    // Use fallbacks for viewport dimensions (window.innerHeight can be undefined in Electron)
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

    let adjustedX = initialX;
    let adjustedY = initialY;

    // Check right edge overflow
    if (initialX + menuWidth > viewportWidth) {
      adjustedX = viewportWidth - menuWidth - 8;
    }

    // Check bottom edge overflow (32px margin accounts for status bar)
    if (initialY + menuHeight > viewportHeight - 24) {
      adjustedY = viewportHeight - menuHeight - 32;
    }

    // Ensure we don't go negative
    adjustedX = Math.max(8, adjustedX);
    adjustedY = Math.max(8, adjustedY);

    setPosition({ x: adjustedX, y: adjustedY, measured: true });
  }, [menuRef, initialX, initialY]);

  return position;
}
