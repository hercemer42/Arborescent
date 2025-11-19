import { useState, useEffect, RefObject } from 'react';

const MIN_PANEL_HEIGHT = 100;
const MAX_PANEL_HEIGHT_RATIO = 0.8;
const MIN_PANEL_WIDTH = 200;
const MAX_PANEL_WIDTH_RATIO = 0.8;

interface UsePanelResizeOptions {
  contentRef: RefObject<HTMLDivElement | null>;
  panelPosition: 'bottom' | 'side';
  panelHeight: number;
  panelWidth: number;
  setPanelHeight: (height: number) => void;
  setPanelWidth: (width: number) => void;
}

/**
 * Generic hook to handle panel resize functionality
 * Works with any panel that can be positioned at the bottom or side
 */
export function usePanelResize({
  contentRef,
  panelPosition,
  panelHeight,
  panelWidth,
  setPanelHeight,
  setPanelWidth,
}: UsePanelResizeOptions) {
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!contentRef.current) return;

      const contentRect = contentRef.current.getBoundingClientRect();

      if (panelPosition === 'bottom') {
        // Vertical resize for bottom panel
        const maxHeight = contentRect.height * MAX_PANEL_HEIGHT_RATIO;
        const newHeight = contentRect.bottom - e.clientY;

        const clampedHeight = Math.max(
          MIN_PANEL_HEIGHT,
          Math.min(maxHeight, newHeight)
        );

        setPanelHeight(clampedHeight);
      } else {
        // Horizontal resize for side panel
        const maxWidth = contentRect.width * MAX_PANEL_WIDTH_RATIO;
        const newWidth = contentRect.right - e.clientX;

        const clampedWidth = Math.max(
          MIN_PANEL_WIDTH,
          Math.min(maxWidth, newWidth)
        );

        setPanelWidth(clampedWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, panelPosition, contentRef, setPanelHeight, setPanelWidth]);

  return {
    panelHeight,
    panelWidth,
    isResizing,
    handleMouseDown,
  };
}
