import { useState, useEffect, RefObject } from 'react';
import { useBrowserStore } from '../../../store/browser/browserStore';

const MIN_BROWSER_HEIGHT = 100;
const MAX_BROWSER_HEIGHT_RATIO = 0.8;
const MIN_BROWSER_WIDTH = 200;
const MAX_BROWSER_WIDTH_RATIO = 0.8;

interface UseBrowserResizeOptions {
  contentRef: RefObject<HTMLDivElement | null>;
  panelPosition: 'bottom' | 'side';
}

export function useBrowserResize({
  contentRef,
  panelPosition,
}: UseBrowserResizeOptions) {
  const browserHeight = useBrowserStore((state) => state.panelHeight);
  const browserWidth = useBrowserStore((state) => state.panelWidth);
  const setPanelHeight = useBrowserStore((state) => state.actions.setPanelHeight);
  const setPanelWidth = useBrowserStore((state) => state.actions.setPanelWidth);
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
        const maxHeight = contentRect.height * MAX_BROWSER_HEIGHT_RATIO;
        const newHeight = contentRect.bottom - e.clientY;

        const clampedHeight = Math.max(
          MIN_BROWSER_HEIGHT,
          Math.min(maxHeight, newHeight)
        );

        setPanelHeight(clampedHeight);
      } else {
        // Horizontal resize for side panel
        const maxWidth = contentRect.width * MAX_BROWSER_WIDTH_RATIO;
        const newWidth = contentRef.current.getBoundingClientRect().right - e.clientX;

        const clampedWidth = Math.max(
          MIN_BROWSER_WIDTH,
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
    browserHeight,
    browserWidth,
    isResizing,
    handleMouseDown,
  };
}
