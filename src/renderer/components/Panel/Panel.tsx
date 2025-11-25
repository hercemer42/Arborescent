import { RefObject } from 'react';
import { usePanelStore } from '../../store/panel/panelStore';
import { TerminalPanel } from '../Terminal/TerminalPanel';
import { BrowserPanel } from '../Browser/BrowserPanel';
import { FeedbackPanel } from '../Feedback/FeedbackPanel';
import { ResizablePanel } from '../ResizablePanel';
import './Panel.css';

interface PanelProps {
  contentRef: RefObject<HTMLDivElement | null>;
}

/**
 * Unified panel component that can display either terminal or browser content
 * The panel configuration (position, size) is shared regardless of content type
 */
export function Panel({ contentRef }: PanelProps) {
  const panelPosition = usePanelStore((state) => state.panelPosition);
  const panelHeight = usePanelStore((state) => state.panelHeight);
  const panelWidth = usePanelStore((state) => state.panelWidth);
  const activeContent = usePanelStore((state) => state.activeContent);
  const setPanelHeight = usePanelStore((state) => state.setPanelHeight);
  const setPanelWidth = usePanelStore((state) => state.setPanelWidth);

  const isPanelVisible = activeContent !== null;

  return (
    <ResizablePanel
      contentRef={contentRef}
      panelPosition={panelPosition}
      panelHeight={panelHeight}
      panelWidth={panelWidth}
      setPanelHeight={setPanelHeight}
      setPanelWidth={setPanelWidth}
      isVisible={isPanelVisible}
      className="unified-panel"
    >
      <div style={{ display: activeContent === 'terminal' ? 'block' : 'none', height: '100%' }}>
        <TerminalPanel />
      </div>
      <div style={{ display: activeContent === 'browser' ? 'block' : 'none', height: '100%' }}>
        <BrowserPanel />
      </div>
      <div style={{ display: activeContent === 'feedback' ? 'block' : 'none', height: '100%' }}>
        <FeedbackPanel />
      </div>
    </ResizablePanel>
  );
}
