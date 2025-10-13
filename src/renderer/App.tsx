import { useEffect, useState } from 'react';
import { Tree } from './components/Tree';
import { ToastContainer } from './components/Toast';
import { useTreeStore } from './store/treeStore';
import { useToastStore } from './store/toastStore';
import { logger } from './services/logger';
import { ElectronErrorService } from '@platform/error';
import { ElectronStorageService } from '@platform/storage';
import { createBlankDocument } from './data/defaultTemplate';
import './App.css';

const errorService = new ElectronErrorService();
const storageService = new ElectronStorageService();

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const initialize = useTreeStore((state) => state.actions.initialize);
  const loadFromPath = useTreeStore((state) => state.actions.loadFromPath);
  const selectNode = useTreeStore((state) => state.actions.selectNode);
  const toasts = useToastStore((state) => state.toasts);
  const addToast = useToastStore((state) => state.addToast);
  const removeToast = useToastStore((state) => state.removeToast);

  useEffect(() => {
    const initializeApp = async () => {
      const lastSession = storageService.getLastSession();

      if (lastSession) {
        try {
          await loadFromPath(lastSession);
          logger.success(`Restored session: ${lastSession}`, 'SessionRestore', false);
          setIsInitializing(false);
          return;
        } catch (error) {
          logger.error(
            `Failed to restore session: ${error instanceof Error ? error.message : 'Unknown error'}`,
            error instanceof Error ? error : undefined,
            'SessionRestore',
            false
          );
        }
      }

      const blank = createBlankDocument();
      initialize(blank.nodes, blank.rootNodeId, blank.nodeTypeConfig);

      selectNode(blank.firstNodeId, 0);

      setIsInitializing(false);
    };

    initializeApp();
  }, [initialize, loadFromPath, selectNode]);

  useEffect(() => {
    logger.setToastCallback(addToast);

    errorService.onError((message) => {
      logger.error(message, undefined, 'Main Process', true);
    });
  }, [addToast]);

  return (
    <div className="app">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <header className="app-header">
        <h1>Arborescent</h1>
        <p>Development workflow tool</p>
      </header>

      <main className="app-main">
        <div className="app-content">
          {isInitializing ? null : <Tree />}
        </div>
      </main>
    </div>
  );
}

export default App;
