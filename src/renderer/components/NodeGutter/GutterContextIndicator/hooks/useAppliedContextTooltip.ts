import { useState, useRef, useCallback } from 'react';

interface TooltipPosition {
  top: number;
  left: number;
}

export function useAppliedContextTooltip() {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({ top: 0, left: 0 });
  const indicatorRef = useRef<HTMLElement>(null);

  const handleMouseEnter = useCallback(() => {
    if (indicatorRef.current) {
      const rect = indicatorRef.current.getBoundingClientRect();
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
    indicatorRef,
    showTooltip,
    tooltipPosition,
    handleMouseEnter,
    handleMouseLeave,
  };
}
