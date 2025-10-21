import { useEffect, useState } from 'react';
import { useTabsStore } from './store/tabs/tabsStore';
import { storeManager } from './store/storeManager';
import { logger } from './services/logger';
import { ElectronStorageService } from '@platform/storage';
import { createBlankDocument } from './data/defaultTemplate';

const storageService = new ElectronStorageService();

export function useAppInitialization() {
  const [isInitializing, setIsInitializing] = useState(true);
  const openFile = useTabsStore((state) => state.openFile);

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

      actions.initialize(blank.nodes, blank.rootNodeId);
      actions.selectNode(blank.firstNodeId, 0);

      openFile(untitledPath, 'Untitled');

      setIsInitializing(false);
    };

    initializeApp();
  }, [openFile]);

  return { isInitializing };
}
