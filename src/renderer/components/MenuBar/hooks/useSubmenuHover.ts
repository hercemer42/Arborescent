import { useState, useRef, useEffect, useCallback } from 'react';

interface UseSubmenuHoverOptions {
  disabled?: boolean;
  closeDelay?: number;
}

export function useSubmenuHover({ disabled, closeDelay = 100 }: UseSubmenuHoverOptions = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const submenuRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = useCallback(() => {
    if (disabled) return;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsOpen(true);
  }, [disabled]);

  const handleMouseLeave = useCallback(() => {
    timeoutRef.current = setTimeout(() => {
      setIsOpen(false);
    }, closeDelay);
  }, [closeDelay]);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    isOpen,
    submenuRef,
    handleMouseEnter,
    handleMouseLeave,
  };
}
