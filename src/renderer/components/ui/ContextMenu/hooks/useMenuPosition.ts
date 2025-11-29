import { RefObject, useState, useLayoutEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

/**
 * Hook that adjusts menu position to keep it within viewport boundaries.
 * Uses useLayoutEffect to measure and reposition before paint.
 */
export function useMenuPosition(
  menuRef: RefObject<HTMLDivElement | null>,
  initialX: number,
  initialY: number
): Position {
  const [position, setPosition] = useState<Position>({ x: initialX, y: initialY });

  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (!menu) {
      setPosition({ x: initialX, y: initialY });
      return;
    }

    const rect = menu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let adjustedX = initialX;
    let adjustedY = initialY;

    // Check right edge overflow
    if (initialX + rect.width > viewportWidth) {
      adjustedX = viewportWidth - rect.width - 8; // 8px margin
    }

    // Check bottom edge overflow
    if (initialY + rect.height > viewportHeight) {
      adjustedY = viewportHeight - rect.height - 8; // 8px margin
    }

    // Ensure we don't go negative
    adjustedX = Math.max(8, adjustedX);
    adjustedY = Math.max(8, adjustedY);

    setPosition({ x: adjustedX, y: adjustedY });
  }, [menuRef, initialX, initialY]);

  return position;
}
