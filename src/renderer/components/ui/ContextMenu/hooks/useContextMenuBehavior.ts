import { useEffect, useRef, useState, useCallback } from 'react';
import { ContextMenuItem } from '../ContextMenu';

export function useContextMenuBehavior(onClose: () => void) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

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
