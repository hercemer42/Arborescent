import { useEffect, useState } from 'react';
import { Tree } from './components/Tree';
import { TabBar } from './components/TabBar';
import { ToastContainer } from './components/Toast';
import { TreeStoreContext } from './store/tree/TreeStoreContext';
import { useTabsStore } from './store/tabs/tabsStore';
import { storeManager } from './store/storeManager';
import { useToastStore } from './store/toast/toastStore';
import { useTabListeners } from './components/TabBar/useTabListeners';
import { logger } from './services/logger';
import { ElectronErrorService } from '@platform/error';
import { ElectronStorageService } from '@platform/storage';
import { createBlankDocument } from './data/defaultTemplate';
import './App.css';

const errorService = new ElectronErrorService();
const storageService = new ElectronStorageService();

function App() {
  const [isInitializing, setIsInitializing] = useState(true);
  const openFile = useTabsStore((state) => state.openFile);
  const activeFilePath = useTabsStore((state) => state.activeFilePath);
  const toasts = useToastStore((state) => state.toasts);
  const addToast = useToastStore((state) => state.addToast);
  const removeToast = useToastStore((state) => state.removeToast);

  useTabListeners();

  useEffect(() => {
    const initializeApp = async () => {
      const lastSession = storageService.getLastSession();

      if (lastSession) {
        try {
          const store = storeManager.getStoreForFile(lastSession);
          const { actions } = store.getState();
          await actions.loadFromPath(lastSession);

          const displayName = lastSession.split('/').pop() || lastSession;
          openFile(lastSession, displayName);

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
      const untitledPath = 'Untitled';
      const store = storeManager.getStoreForFile(untitledPath);
      const { actions } = store.getState();

      actions.initialize(blank.nodes, blank.rootNodeId, blank.nodeTypeConfig);
      actions.selectNode(blank.firstNodeId, 0);

      openFile(untitledPath, 'Untitled');

      setIsInitializing(false);
    };

    initializeApp();
  }, [openFile]);

  useEffect(() => {
    logger.setToastCallback(addToast);

    errorService.onError((message) => {
      logger.error(message, undefined, 'Main Process', true);
    });
  }, [addToast]);

  const activeStore = activeFilePath ? storeManager.getStoreForFile(activeFilePath) : null;

  return (
    <div className="app">
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      <header className="app-header">
        <h1>Arborescent</h1>
        <p>Development workflow tool</p>
      </header>

      <main className="app-main">
        <div className="app-content">
          {!isInitializing && activeStore && (
            <TreeStoreContext.Provider value={activeStore}>
              <TabBar />
              <Tree />
            </TreeStoreContext.Provider>
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
