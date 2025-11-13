import { RefObject } from 'react';
import { TerminalPanel } from './TerminalPanel';
import { useTerminalStore } from '../../store/terminal/terminalStore';
import { useTerminalResize } from './hooks/useTerminalResize';
import { useTerminalKeyboardShortcut } from './hooks/useTerminalKeyboardShortcut';
import './TerminalContainer.css';

interface TerminalContainerProps {
  contentRef: RefObject<HTMLDivElement | null>;
}

export function TerminalContainer({ contentRef }: TerminalContainerProps) {

  const panelPosition = useTerminalStore((state) => state.panelPosition);
  const isTerminalVisible = useTerminalStore((state) => state.isTerminalVisible);
  const toggleTerminalVisibility = useTerminalStore((state) => state.toggleTerminalVisibility);

  const { terminalHeight, terminalWidth, isResizing, handleMouseDown } = useTerminalResize({
    contentRef,
    panelPosition,
  });

  useTerminalKeyboardShortcut(toggleTerminalVisibility);

  return (
    <>
      <div
        className={`resize-handle ${panelPosition === 'side' ? 'horizontal' : 'vertical'} ${
          isResizing ? 'resizing' : ''
        }`}
        onMouseDown={handleMouseDown}
        style={{ display: isTerminalVisible ? 'block' : 'none' }}
      >
        <div className="resize-handle-line" />
      </div>
      <div
        className="terminal-container"
        style={{
          display: isTerminalVisible ? 'block' : 'none',
          ...(panelPosition === 'side'
            ? { width: `${terminalWidth}px` }
            : { height: `${terminalHeight}px` }),
        }}
      >
        <TerminalPanel />
      </div>
    </>
  );
}
