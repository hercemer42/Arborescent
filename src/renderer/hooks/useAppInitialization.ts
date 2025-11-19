import { useEffect } from 'react';
import { useFilesStore } from '../store/files/filesStore';
import { useBrowserStore } from '../store/browser/browserStore';
import { useTerminalStore } from '../store/terminal/terminalStore';
import { usePanelStore } from '../store/panel/panelStore';
import { createTerminal } from '../services/terminalService';

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
        // Auto-create a terminal if none exist AND panel is not visible
        const activeContent = usePanelStore.getState().activeContent;
        const terminals = useTerminalStore.getState().terminals;
        if (terminals.length === 0 && !activeContent) {
          await createTerminal('Terminal');
        }
      })
      .finally(() => onComplete());
  }, [onComplete]);
}
