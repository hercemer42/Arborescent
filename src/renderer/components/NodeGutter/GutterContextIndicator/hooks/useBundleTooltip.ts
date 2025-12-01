import { useState, useRef, useCallback } from 'react';

interface TooltipPosition {
  top: number;
  left: number;
}

export function useBundleTooltip(onIconClick?: () => void) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ top: 0, left: 0 });
  const bundleRef = useRef<HTMLButtonElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (bundleRef.current) {
      const rect = bundleRef.current.getBoundingClientRect();
      setTooltipPosition({
        top: rect.top + rect.height / 2,
        left: rect.right + 8,
      });
    }
    setShowTooltip(true);
  }, []);

  const handleMouseLeave = useCallback(() => {
    setShowTooltip(false);
  }, []);

  const handleIconClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onIconClick?.();
  }, [onIconClick]);

  return {
    bundleRef,
    showTooltip,
    tooltipPosition,
    handleMouseEnter,
    handleMouseLeave,
    handleIconClick,
  };
}
