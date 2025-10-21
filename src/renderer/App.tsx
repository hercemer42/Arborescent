import { ToastContainer } from './components/Toast';
import { Workspace } from './components/Workspace';
import { useToastStore } from './store/toast/toastStore';
import { useTab } from './components/TabBar/hooks/useTab';
import { useAppInitialization } from './useAppInitialization';
import { useAppErrorHandling } from './useAppErrorHandling';
import './App.css';

export function App() {
  const { isInitializing } = useAppInitialization();
  const toasts = useToastStore((state) => state.toasts);
  const removeToast = useToastStore((state) => state.removeToast);

  useTab();
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

