import { useState, useCallback, useRef, useEffect } from 'react';

interface UseShortcutContextMenuProps {
  onRemove: () => void;
  onReset: () => void;
}

interface ContextMenuPosition {
  x: number;
  y: number;
}

export function useShortcutContextMenu({ onRemove, onReset }: UseShortcutContextMenuProps) {
  const [contextMenu, setContextMenu] = useState<ContextMenuPosition | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  }, []);

  const handleClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  const handleRemove = useCallback(() => {
    onRemove();
    handleClose();
  }, [onRemove, handleClose]);

  const handleReset = useCallback(() => {
    onReset();
    handleClose();
  }, [onReset, handleClose]);

  // Close on click outside
  useEffect(() => {
    if (!contextMenu) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [contextMenu, handleClose]);

  return {
    contextMenu,
    menuRef,
    handleContextMenu,
    handleRemove,
    handleReset,
  };
}
