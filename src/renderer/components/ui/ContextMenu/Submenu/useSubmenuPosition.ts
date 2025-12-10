import { RefObject, useState, useLayoutEffect } from 'react';

interface SubmenuPosition {
  flipHorizontal: boolean;
  flipVertical: boolean;
}

export function useSubmenuPosition(
  submenuRef: RefObject<HTMLDivElement | null>
): SubmenuPosition {
  const [position, setPosition] = useState<SubmenuPosition>({
    flipHorizontal: false,
    flipVertical: false,
  });

  useLayoutEffect(() => {
    const submenu = submenuRef.current;
    if (!submenu) return;

    const rect = submenu.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const flipHorizontal = rect.right > viewportWidth;
    const flipVertical = rect.bottom > viewportHeight;

    setPosition({ flipHorizontal, flipVertical });
  }, [submenuRef]);

  return position;
}
