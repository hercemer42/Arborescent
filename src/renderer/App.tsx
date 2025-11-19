import { useState, useRef } from 'react';
import { ToastContainer } from './components/Toast';
import { Workspace } from './components/Workspace';
import { TerminalContainer } from './components/Terminal';
import { BrowserContainer } from './components/Browser';
import { useToastStore } from './store/toast/toastStore';
import { useTerminalStore } from './store/terminal/terminalStore';
import { useBrowserStore } from './store/browser/browserStore';
import { useAppErrorHandling } from './useAppErrorHandling';
import { useAppInitialization } from './hooks';
import './App.css';

export function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  const terminalPanelPosition = useTerminalStore((state) => state.panelPosition);
  const isTerminalVisible = useTerminalStore((state) => state.isTerminalVisible);
  const browserPanelPosition = useBrowserStore((state) => state.panelPosition);
  const isBrowserVisible = useBrowserStore((state) => state.isBrowserVisible);

  // Use whichever panel is visible for layout
  const panelPosition = isBrowserVisible ? browserPanelPosition : terminalPanelPosition;
  const isPanelVisible = isTerminalVisible || isBrowserVisible;

  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  useAppInitialization(() => setIsInitializing(false));
  useAppErrorHandling();

  return (
    <div className="app">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <header className="app-header">
        <h1>Arborescent</h1>
        <p>Development workflow tool</p>
      </header>

      {!isInitializing && (
        <div
          className={`app-content ${
            isPanelVisible && panelPosition === 'side' ? 'side-layout' : 'bottom-layout'
          }`}
          ref={contentRef}
        >
          <div className="workspace-container">
            <Workspace />
          </div>
          <TerminalContainer contentRef={contentRef} />
          <BrowserContainer contentRef={contentRef} />
        </div>
      )}
    </div>
  );
}

