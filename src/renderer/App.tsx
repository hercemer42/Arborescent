import { useEffect, useState, useRef } from 'react';
import { ToastContainer } from './components/Toast';
import { Workspace } from './components/Workspace';
import { TerminalContainer } from './components/Terminal';
import { useToastStore } from './store/toast/toastStore';
import { useFilesStore } from './store/files/filesStore';
import { useTerminalStore } from './store/terminal/terminalStore';
import { useAppErrorHandling } from './useAppErrorHandling';
import { logger } from './services/logger';
import './App.css';

export function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  const panelPosition = useTerminalStore((state) => state.panelPosition);
  const isTerminalVisible = useTerminalStore((state) => state.isTerminalVisible);

  const initializeSession = useFilesStore((state) => state.actions.initializeSession);
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  useEffect(() => {
    initializeSession()
      .catch((err) => {
        logger.error('Failed to initialize session', err, 'App');
      })
      .finally(() => setIsInitializing(false));
  }, [initializeSession]);

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
            isTerminalVisible && panelPosition === 'side' ? 'side-layout' : 'bottom-layout'
          }`}
          ref={contentRef}
        >
          <div className="workspace-container">
            <Workspace />
          </div>
          <TerminalContainer contentRef={contentRef} />
        </div>
      )}
    </div>
  );
}

