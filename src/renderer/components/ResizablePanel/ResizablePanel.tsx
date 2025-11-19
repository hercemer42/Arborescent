import { RefObject, ReactNode } from 'react';
import { usePanelResize } from '../../hooks/usePanelResize';
import './ResizablePanel.css';

interface ResizablePanelProps {
  contentRef: RefObject<HTMLDivElement | null>;
  panelPosition: 'bottom' | 'side';
  panelHeight: number;
  panelWidth: number;
  setPanelHeight: (height: number) => void;
  setPanelWidth: (width: number) => void;
  isVisible: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Generic resizable panel component
 * Can be positioned at the bottom or side of the main content area
 */
export function ResizablePanel({
  contentRef,
  panelPosition,
  panelHeight,
  panelWidth,
  setPanelHeight,
  setPanelWidth,
  isVisible,
  className = '',
  children,
}: ResizablePanelProps) {
  const { isResizing, handleMouseDown } = usePanelResize({
    contentRef,
    panelPosition,
    panelHeight,
    panelWidth,
    setPanelHeight,
    setPanelWidth,
  });

  return (
    <>
      <div
        className={`resize-handle ${panelPosition === 'side' ? 'horizontal' : 'vertical'} ${
          isResizing ? 'resizing' : ''
        }`}
        onMouseDown={handleMouseDown}
        style={{ display: isVisible ? 'block' : 'none' }}
      >
        <div className="resize-handle-line" />
      </div>
      <div
        className={`resizable-panel ${className} ${isResizing ? 'resizing' : ''}`}
        style={{
          display: isVisible ? 'block' : 'none',
          ...(panelPosition === 'side'
            ? { width: `${panelWidth}px` }
            : { height: `${panelHeight}px` }),
        }}
      >
        {children}
      </div>
    </>
  );
}
