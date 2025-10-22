import { useEffect, useState } from 'react';
import { ToastContainer } from './components/Toast';
import { Workspace } from './components/Workspace';
import { useToastStore } from './store/toast/toastStore';
import { useFilesStore } from './store/files/filesStore';
import { useAppErrorHandling } from './useAppErrorHandling';
import './App.css';

export function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const initializeSession = useFilesStore((state) => state.actions.initializeSession);
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  useEffect(() => {
    initializeSession().finally(() => setIsInitializing(false));
  }, [initializeSession]);

  useAppErrorHandling();

  return (
    <div className="app">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <header className="app-header">
        <h1>Arborescent</h1>
        <p>Development workflow tool</p>
      </header>

      {!isInitializing && <Workspace />}
    </div>
  );
}

