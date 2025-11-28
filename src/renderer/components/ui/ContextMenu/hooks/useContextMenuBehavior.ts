import { useRef, useState, useCallback } from 'react';
import { ContextMenuItem } from '../ContextMenu';
import { useDialogBehavior } from '../../../../hooks';

export function useContextMenuBehavior(onClose: () => void) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);

  useDialogBehavior(menuRef, onClose);

  const handleItemClick = useCallback((item: ContextMenuItem) => {
    if (item.submenu) {
      return; // Don't close menu when clicking on submenu parent
    }
    if (item.onClick) {
      item.onClick();
    }
    onClose();
  }, [onClose]);

  const handleSubmenuItemClick = useCallback((item: ContextMenuItem) => {
    if (item.onClick) {
      item.onClick();
    }
    onClose();
  }, [onClose]);

  const handleSubmenuEnter = useCallback((index: number) => {
    setOpenSubmenu(index);
  }, []);

  const handleSubmenuLeave = useCallback(() => {
    setOpenSubmenu(null);
  }, []);

  return {
    menuRef,
    openSubmenu,
    handleItemClick,
    handleSubmenuItemClick,
    handleSubmenuEnter,
    handleSubmenuLeave,
  };
}
