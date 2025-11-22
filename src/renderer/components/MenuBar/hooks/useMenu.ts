import { useRef, useEffect, useCallback, KeyboardEvent, RefObject } from 'react';
import { useMenuBarStore } from '../store';

interface UseMenuProps {
  id: string;
}

interface UseMenuReturn {
  isOpen: boolean;
  menuRef: RefObject<HTMLDivElement | null>;
  triggerRef: RefObject<HTMLButtonElement | null>;
  itemsRef: RefObject<HTMLDivElement | null>;
  handleTriggerClick: () => void;
  handleTriggerKeyDown: (e: KeyboardEvent<HTMLButtonElement>) => void;
  handleMenuKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
  handleMouseEnter: () => void;
}

export function useMenu({ id }: UseMenuProps): UseMenuReturn {
  const openMenuId = useMenuBarStore((state) => state.openMenuId);
  const setOpenMenuId = useMenuBarStore((state) => state.setOpenMenuId);
  const closeMenu = useMenuBarStore((state) => state.closeMenu);

  const isOpen = openMenuId === id;
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef<HTMLDivElement>(null);

  // Handle Escape key to close
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMenu();
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, closeMenu]);

  // Focus first item when menu opens
  useEffect(() => {
    if (isOpen && itemsRef.current) {
      const firstItem = itemsRef.current.querySelector<HTMLButtonElement>(
        '.menu-item:not(:disabled)'
      );
      firstItem?.focus();
    }
  }, [isOpen]);

  const handleTriggerClick = useCallback(() => {
    if (isOpen) {
      closeMenu();
    } else {
      setOpenMenuId(id);
    }
  }, [isOpen, id, setOpenMenuId, closeMenu]);

  const handleTriggerKeyDown = useCallback(
    (e: KeyboardEvent<HTMLButtonElement>) => {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpenMenuId(id);
      }
    },
    [id, setOpenMenuId]
  );

  const handleMenuKeyDown = useCallback((e: KeyboardEvent<HTMLDivElement>) => {
    const items = itemsRef.current?.querySelectorAll<HTMLButtonElement>(
      '.menu-item:not(:disabled)'
    );
    if (!items || items.length === 0) return;

    const currentIndex = Array.from(items).findIndex(
      (item) => item === document.activeElement
    );

    switch (e.key) {
      case 'ArrowDown': {
        e.preventDefault();
        const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        items[nextIndex].focus();
        break;
      }
      case 'ArrowUp': {
        e.preventDefault();
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        items[prevIndex].focus();
        break;
      }
      case 'Home':
        e.preventDefault();
        items[0].focus();
        break;
      case 'End':
        e.preventDefault();
        items[items.length - 1].focus();
        break;
    }
  }, []);

  // Handle hover to switch menus when one is already open
  const handleMouseEnter = useCallback(() => {
    if (openMenuId !== null && openMenuId !== id) {
      setOpenMenuId(id);
    }
  }, [openMenuId, id, setOpenMenuId]);

  return {
    isOpen,
    menuRef,
    triggerRef,
    itemsRef,
    handleTriggerClick,
    handleTriggerKeyDown,
    handleMenuKeyDown,
    handleMouseEnter,
  };
}
