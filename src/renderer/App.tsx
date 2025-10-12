import { useEffect } from 'react';
import { Tree } from './components/Tree';
import { ToastContainer } from './components/Toast';
import { sampleDocument } from './data/sampleData';
import { useTreeStore } from './store/treeStore';
import { useToastStore } from './store/toastStore';
import { logger } from './services/logger';
import { ElectronErrorService } from '@platform/error';
import './App.css';

const errorService = new ElectronErrorService();

function App() {
  const initialize = useTreeStore((state) => state.actions.initialize);
  const toasts = useToastStore((state) => state.toasts);
  const addToast = useToastStore((state) => state.addToast);
  const removeToast = useToastStore((state) => state.removeToast);

  useEffect(() => {
    initialize(
      sampleDocument.nodes,
      sampleDocument.rootNodeId,
      sampleDocument.nodeTypeConfig || {}
    );
  }, [initialize]);

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
          <Tree />
        </div>
      </main>
    </div>
  );
}

export default App;
