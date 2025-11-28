import { useEffect } from 'react';

/**
 * Hook that calls a callback when the Escape key is pressed.
 * Commonly used for closing dialogs, menus, and modals.
 */
export function useEscapeKey(onEscape: () => void): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onEscape]);
}
