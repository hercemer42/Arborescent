import { useState, useRef, useCallback } from 'react';
import { ToastContainer } from './components/Toast';
import { Workspace } from './components/Workspace';
import { Panel } from './components/Panel';
import { BottomStatusBar } from './components/BottomStatusBar/BottomStatusBar';
import { useToastStore } from './store/toast/toastStore';
import { usePanelStore } from './store/panel/panelStore';
import { useAppErrorHandling } from './useAppErrorHandling';
import { useAppInitialization } from './hooks';
import './App.css';

export function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);

  const panelPosition = usePanelStore((state) => state.panelPosition);
  const activeContent = usePanelStore((state) => state.activeContent);
  const isPanelVisible = activeContent !== null;

  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  // Memoize to prevent re-initialization on every render
  const handleInitComplete = useCallback(() => setIsInitializing(false), []);
  useAppInitialization(handleInitComplete);
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
          <Panel contentRef={contentRef} />
        </div>
      )}

      <BottomStatusBar />
    </div>
  );
}

