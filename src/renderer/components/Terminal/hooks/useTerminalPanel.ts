import { useTerminalStore } from '../../../store/terminal/terminalStore';
import { logger } from '../../../services/logger';

/**
 * Hook to manage terminal panel operations
 * Handles creating and closing terminals
 */
export function useTerminalPanel() {
  const { terminals, addTerminal, removeTerminal } = useTerminalStore();

  const handleNewTerminal = async () => {
    const id = `terminal-${Date.now()}`;
    const title = `Terminal ${terminals.length + 1}`;

    try {
      const terminalInfo = await window.electron.terminalCreate(id, title);
      addTerminal(terminalInfo);
    } catch (error) {
      logger.error('Failed to create terminal', error as Error, 'TerminalPanel');
    }
  };

  const handleCloseTerminal = async (id: string) => {
    try {
      await window.electron.terminalDestroy(id);
      removeTerminal(id);
    } catch (error) {
      logger.error('Failed to close terminal', error as Error, 'TerminalPanel');
    }
  };

  return {
    handleNewTerminal,
    handleCloseTerminal,
  };
}
