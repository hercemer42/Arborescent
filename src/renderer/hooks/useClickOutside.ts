import { useEffect, RefObject } from 'react';

/**
 * Hook that calls a callback when a click occurs outside the referenced element.
 * Commonly used for closing dropdowns, menus, and modals.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onClickOutside: () => void
): void {
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClickOutside();
      }
    };

    document.addEventListener('mousedown', handleMouseDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [ref, onClickOutside]);
}
