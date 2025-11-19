import { useCallback } from 'react';
import { useTerminalStore } from '../../../store/terminal/terminalStore';
import { createTerminal } from '../../../services/terminalService';
import { logger } from '../../../services/logger';

/**
 * Hook to manage terminal panel operations
 * Handles creating and closing terminals
 */
export function useTerminalPanel() {
  const { terminals, removeTerminal } = useTerminalStore();

  const handleNewTerminal = useCallback(async () => {
    const title = `Terminal ${terminals.length + 1}`;
    await createTerminal(title);
  }, [terminals.length]);

  const handleCloseTerminal = useCallback(async (id: string) => {
    try {
      await window.electron.terminalDestroy(id);
      removeTerminal(id);
    } catch (error) {
      logger.error('Failed to close terminal', error as Error, 'TerminalPanel');
    }
  }, [removeTerminal]);

  return {
    handleNewTerminal,
    handleCloseTerminal,
  };
}
