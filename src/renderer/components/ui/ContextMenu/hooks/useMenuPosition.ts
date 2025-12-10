import { RefObject, useState, useLayoutEffect } from 'react';

interface Position {
  x: number;
  y: number;
}

interface MenuPosition extends Position {
  measured: boolean;
}

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
    const menuHeight = Math.max(rect.height, menu.scrollHeight || 0);
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || document.body.clientHeight;

    let adjustedX = initialX;
    let adjustedY = initialY;

    if (initialX + menuWidth > viewportWidth) {
      adjustedX = viewportWidth - menuWidth - 8;
    }

    if (initialY + menuHeight > viewportHeight - 24) {
      adjustedY = viewportHeight - menuHeight - 32;
    }

    adjustedX = Math.max(8, adjustedX);
    adjustedY = Math.max(8, adjustedY);

    setPosition({ x: adjustedX, y: adjustedY, measured: true });
  }, [menuRef, initialX, initialY]);

  return position;
}
