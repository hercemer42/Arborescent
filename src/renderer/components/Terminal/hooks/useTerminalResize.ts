import { useState, useEffect, RefObject } from 'react';

const MIN_TERMINAL_HEIGHT = 100;
const MAX_TERMINAL_HEIGHT_RATIO = 0.8;
const MIN_TERMINAL_WIDTH = 200;
const MAX_TERMINAL_WIDTH_RATIO = 0.8;

interface UseTerminalResizeOptions {
  contentRef: RefObject<HTMLDivElement | null>;
  panelPosition: 'bottom' | 'side';
  initialHeight?: number;
  initialWidth?: number;
}

export function useTerminalResize({
  contentRef,
  panelPosition,
  initialHeight = 300,
  initialWidth = typeof window !== 'undefined' ? window.innerWidth * 0.5 : 600,
}: UseTerminalResizeOptions) {
  const [terminalHeight, setTerminalHeight] = useState(initialHeight);
  const [terminalWidth, setTerminalWidth] = useState(initialWidth);
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
        const maxHeight = contentRect.height * MAX_TERMINAL_HEIGHT_RATIO;
        const newHeight = contentRect.bottom - e.clientY;

        const clampedHeight = Math.max(
          MIN_TERMINAL_HEIGHT,
          Math.min(maxHeight, newHeight)
        );

        setTerminalHeight(clampedHeight);
      } else {
        // Horizontal resize for side panel
        const maxWidth = contentRect.width * MAX_TERMINAL_WIDTH_RATIO;
        const newWidth = contentRef.current.getBoundingClientRect().right - e.clientX;

        const clampedWidth = Math.max(
          MIN_TERMINAL_WIDTH,
          Math.min(maxWidth, newWidth)
        );

        setTerminalWidth(clampedWidth);
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
  }, [isResizing, panelPosition, contentRef]);

  return {
    terminalHeight,
    terminalWidth,
    isResizing,
    handleMouseDown,
  };
}
