import { useEffect } from 'react';
import { useFilesStore } from '../store/files/filesStore';
import { useBrowserStore } from '../store/browser/browserStore';
import { useTerminalStore } from '../store/terminal/terminalStore';
import { usePanelStore } from '../store/panel/panelStore';

/**
 * Hook to handle app-level initialization on startup
 * Restores sessions and auto-creates terminal if needed
 */
export function useAppInitialization(onComplete: () => void) {
  useEffect(() => {
    const initializeSession = useFilesStore.getState().actions.initializeSession;
    const restoreBrowserSession = useBrowserStore.getState().actions.restoreSession;
    const restorePanelSession = usePanelStore.getState().restoreSession;

    Promise.all([
      initializeSession(),
      restoreBrowserSession(),
      restorePanelSession(),
    ])
      .then(async () => {
        // Auto-create a terminal if none exist AND terminal panel is active
        const activeContent = usePanelStore.getState().activeContent;
        const terminalStore = useTerminalStore.getState();
        if (terminalStore.terminals.length === 0 && activeContent === 'terminal') {
          await terminalStore.createNewTerminal('Terminal');
        }
      })
      .finally(() => onComplete());
  }, [onComplete]);
}
