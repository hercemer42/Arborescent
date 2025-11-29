import { useRef } from 'react';
import { useDialogBehavior } from '../../../../hooks';
import { useSubmenuBehavior } from '../Submenu/useSubmenuBehavior';

// Hook for the root context menu (includes dialog behavior)
export function useContextMenuBehavior(onClose: () => void) {
  const menuRef = useRef<HTMLDivElement>(null);
  const submenuBehavior = useSubmenuBehavior(onClose);

  useDialogBehavior(menuRef, onClose);

  return {
    menuRef,
    ...submenuBehavior,
  };
}
