import { useState, useRef, useCallback } from 'react';
import { ToastContainer } from './components/Toast';
import { Workspace } from './components/Workspace';
import { Panel } from './components/Panel';
import { BottomStatusBar } from './components/BottomStatusBar/BottomStatusBar';
import { SearchBar } from './components/SearchBar';
import { AppMenuBar } from './components/MenuBar';
import { IconPickerDialog } from './components/ui/IconPicker/IconPickerDialog';
import { useToastStore } from './store/toast/toastStore';
import { usePanelStore } from './store/panel/panelStore';
import { useSearchStore } from './store/search/searchStore';
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
  const isSearchOpen = useSearchStore((state) => state.isOpen);

  // Memoize to prevent re-initialization on every render
  const handleInitComplete = useCallback(() => setIsInitializing(false), []);
  useAppInitialization(handleInitComplete);
  useAppErrorHandling();

  return (
    <div className="app">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <AppMenuBar />

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

      {isSearchOpen ? <SearchBar /> : <BottomStatusBar />}
      <IconPickerDialog />
    </div>
  );
}

