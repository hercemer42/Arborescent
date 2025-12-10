import { useEffect } from 'react';
import { useFilesStore } from '../store/files/filesStore';
import { useBrowserStore } from '../store/browser/browserStore';
import { useTerminalStore } from '../store/terminal/terminalStore';
import { usePanelStore } from '../store/panel/panelStore';
import { usePreferencesStore } from '../store/preferences/preferencesStore';
import { logger } from '../services/logger';

export function useAppInitialization(onComplete: () => void) {
  useEffect(() => {
    const initializeSession = useFilesStore.getState().actions.initializeSession;
    const restoreBrowserSession = useBrowserStore.getState().actions.restoreSession;
    const restorePanelSession = usePanelStore.getState().restoreSession;
    const loadPreferences = usePreferencesStore.getState().loadPreferences;

    Promise.all([
      initializeSession(),
      restoreBrowserSession(),
      restorePanelSession(),
      loadPreferences(),
    ])
      .then(async () => {
        const activeContent = usePanelStore.getState().activeContent;
        const terminalStore = useTerminalStore.getState();
        if (terminalStore.terminals.length === 0 && activeContent === 'terminal') {
          await terminalStore.createNewTerminal('Terminal');
        }
      })
      .catch((error) => {
        logger.error('Failed to initialize session', error, 'App');
      })
      .finally(() => onComplete());
  }, [onComplete]);
}
