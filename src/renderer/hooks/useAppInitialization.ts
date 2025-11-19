import { useEffect } from 'react';
import { useFilesStore } from '../store/files/filesStore';
import { useBrowserStore } from '../store/browser/browserStore';
import { useTerminalStore } from '../store/terminal/terminalStore';
import { createTerminal } from '../services/terminalService';

/**
 * Hook to handle app-level initialization on startup
 * Restores sessions and auto-creates terminal if needed
 */
export function useAppInitialization(onComplete: () => void) {
  useEffect(() => {
    const initializeSession = useFilesStore.getState().actions.initializeSession;
    const restoreBrowserSession = useBrowserStore.getState().actions.restoreSession;

    Promise.all([
      initializeSession(),
      restoreBrowserSession(),
    ])
      .then(async () => {
        // Auto-create a terminal if none exist AND browser is not visible
        const browserVisible = useBrowserStore.getState().isBrowserVisible;
        const terminals = useTerminalStore.getState().terminals;
        if (terminals.length === 0 && !browserVisible) {
          await createTerminal('Terminal');
        }
      })
      .finally(() => onComplete());
  }, [onComplete]);
}
