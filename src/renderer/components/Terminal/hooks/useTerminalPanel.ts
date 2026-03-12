import { useCallback } from 'react';
import { useTerminalStore } from '../../../store/terminal/terminalStore';
import { storeManager } from '../../../store/storeManager';

export function useTerminalPanel() {
  const terminals = useTerminalStore((state) => state.terminals);
  const createNewTerminal = useTerminalStore((state) => state.createNewTerminal);
  const closeTerminal = useTerminalStore((state) => state.closeTerminal);

  const handleNewTerminal = useCallback(async () => {
    const title = `Terminal ${terminals.length + 1}`;
    await createNewTerminal(title);
  }, [terminals.length, createNewTerminal]);

  const handleCloseTerminal = useCallback(async (id: string) => {
    await closeTerminal(id);
    for (const store of storeManager.getAllStores()) {
      store.getState().actions.handleTerminalClosed(id);
    }
  }, [closeTerminal]);

  return {
    handleNewTerminal,
    handleCloseTerminal,
  };
}
