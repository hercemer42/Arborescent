import { useState, useRef, useCallback } from 'react';

interface TooltipPosition {
  top: number;
  left: number;
}

export function useBundleTooltip() {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ top: 0, left: 0 });
  const bundleRef = useRef<HTMLSpanElement>(null);

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

  return {
    bundleRef,
    showTooltip,
    tooltipPosition,
    handleMouseEnter,
    handleMouseLeave,
  };
}
