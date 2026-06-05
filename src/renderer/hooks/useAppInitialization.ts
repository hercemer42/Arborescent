import { useEffect } from 'react';
import { useFilesStore } from '../store/files/filesStore';
import { useBrowserStore } from '../store/browser/browserStore';
import { useTerminalStore } from '../store/terminal/terminalStore';
import { usePanelStore } from '../store/panel/panelStore';
import { usePreferencesStore } from '../store/preferences/preferencesStore';
import { storeManager } from '../store/storeManager';
import { resumeAllRestoredSessions } from '../services/launchSessionResume';
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
        const activeFile = terminalStore.currentFilePath;
        const activeFileState = activeFile ? terminalStore.fileStates[activeFile] : undefined;
        const activeFileHasTerminals =
          (activeFileState?.pendingRestore?.length ?? 0) > 0 || (activeFileState?.terminals.length ?? 0) > 0;

        // Resume every open file's terminals and sessions in the background —
        // independent of the active file and the terminal-panel view — so the
        // window is interactive before the launch fan-out finishes.
        void resumeAllRestoredSessions();

        // An active terminal view with nothing to restore still gets a fresh terminal.
        if (activeContent === 'terminal' && !activeFileHasTerminals) {
          await terminalStore.createNewTerminal('Terminal');
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
          void useTerminalStore.getState().materializeRestoredTerminals();
        }
      }
    });
  }, []);
}
