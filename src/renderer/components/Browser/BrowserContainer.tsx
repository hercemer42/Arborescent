import { RefObject } from 'react';
import { BrowserPanel } from './BrowserPanel';
import { useBrowserStore } from '../../store/browser/browserStore';
import { useBrowserResize } from './hooks/useBrowserResize';
import './BrowserContainer.css';

interface BrowserContainerProps {
  contentRef: RefObject<HTMLDivElement | null>;
}

export function BrowserContainer({ contentRef }: BrowserContainerProps) {
  const panelPosition = useBrowserStore((state) => state.panelPosition);
  const isBrowserVisible = useBrowserStore((state) => state.isBrowserVisible);

  const { browserHeight, browserWidth, isResizing, handleMouseDown } = useBrowserResize({
    contentRef,
    panelPosition,
  });

  return (
    <>
      <div
        className={`resize-handle ${panelPosition === 'side' ? 'horizontal' : 'vertical'} ${
          isResizing ? 'resizing' : ''
        }`}
        onMouseDown={handleMouseDown}
        style={{ display: isBrowserVisible ? 'block' : 'none' }}
      >
        <div className="resize-handle-line" />
      </div>
      <div
        className={`browser-container ${isResizing ? 'resizing' : ''}`}
        style={{
          display: isBrowserVisible ? 'block' : 'none',
          ...(panelPosition === 'side'
            ? { width: `${browserWidth}px` }
            : { height: `${browserHeight}px` }),
        }}
      >
        <BrowserPanel />
      </div>
    </>
  );
}
