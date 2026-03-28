import { useEffect } from 'react';
import { useFilesStore } from '../store/files/filesStore';
import { useBrowserStore } from '../store/browser/browserStore';
import { useTerminalStore } from '../store/terminal/terminalStore';
import { usePanelStore } from '../store/panel/panelStore';
import { usePreferencesStore } from '../store/preferences/preferencesStore';
import { storeManager } from '../store/storeManager';
import { logger } from '../services/logger';

export function useAppInitialization(onComplete: () => void) {
  useEffect(() => {
    const initializeSession = useFilesStore.getState().actions.initializeSession;
    const restoreBrowserSession = useBrowserStore.getState().actions.restoreSession;
    const restorePanelSession = usePanelStore.getState().restoreSession;
    const restoreTerminalSession = useTerminalStore.getState().restoreTerminalSession;
    const loadPreferences = usePreferencesStore.getState().loadPreferences;

    Promise.all([
      initializeSession(),
      restoreBrowserSession(),
      restorePanelSession(),
      restoreTerminalSession(),
      loadPreferences(),
    ])
      .then(async () => {
        for (const store of storeManager.getAllStores()) {
          store.getState().actions.initializeExecutionState();
        }

        const initialFilePath = useFilesStore.getState().activeFilePath;
        usePanelStore.getState().setActiveFile(initialFilePath);
        useTerminalStore.getState().setActiveFile(initialFilePath);
        useBrowserStore.getState().actions.setActiveFile(initialFilePath);

        const activeContent = usePanelStore.getState().activeContent;
        const terminalStore = useTerminalStore.getState();
        if (activeContent === 'terminal') {
          await terminalStore.materializeRestoredTerminals();
          if (useTerminalStore.getState().terminals.length === 0) {
            await terminalStore.createNewTerminal('Terminal');
          }
        }
      })
      .catch((error) => {
        logger.error('Failed to initialize session', error, 'App');
      })
      .finally(() => onComplete());
  }, [onComplete]);

  useEffect(() => {
    let previousFilePath = useFilesStore.getState().activeFilePath;
    return useFilesStore.subscribe((state) => {
      if (state.activeFilePath !== previousFilePath) {
        previousFilePath = state.activeFilePath;
        usePanelStore.getState().setActiveFile(state.activeFilePath);
        useTerminalStore.getState().setActiveFile(state.activeFilePath);
        useBrowserStore.getState().actions.setActiveFile(state.activeFilePath);

        const activeContent = usePanelStore.getState().activeContent;
        if (activeContent === 'terminal') {
          useTerminalStore.getState().materializeRestoredTerminals();
        }
      }
    });
  }, []);
}
