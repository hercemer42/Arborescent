import { useState, useCallback } from 'react';
import { ContextMenuItem } from '../ContextMenu';

export function useSubmenuBehavior(onClose: () => void) {
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);

  const handleItemClick = useCallback((item: ContextMenuItem, index?: number) => {
    if (item.submenu) {
      // Toggle submenu on click
      setOpenSubmenu(prev => prev === index ? null : index ?? null);
      return;
    }
    if (item.onClick) {
      item.onClick();
    }
    onClose();
  }, [onClose]);

  return {
    openSubmenu,
    handleItemClick,
  };
}
