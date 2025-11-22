import { useCallback, KeyboardEvent } from 'react';
import { useMenuBarStore } from '../store';

interface UseMenuItemProps {
  onClick?: () => void;
  disabled?: boolean;
}

interface UseMenuItemReturn {
  handleClick: () => void;
  handleKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
}

export function useMenuItem({ onClick, disabled }: UseMenuItemProps): UseMenuItemReturn {
  const closeMenu = useMenuBarStore((state) => state.closeMenu);

  const handleClick = useCallback(() => {
    if (disabled) return;
    onClick?.();
    closeMenu();
  }, [disabled, onClick, closeMenu]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleClick();
      }
    },
    [handleClick]
  );

  return {
    handleClick,
    handleKeyDown,
  };
}
