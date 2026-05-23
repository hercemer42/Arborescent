import { useCallback } from 'react';
import { useTerminalStore } from '../../../store/terminal/terminalStore';
import { requestGuardedTerminalClose } from '../../../services/terminalCloseService';

export function useTerminalPanel() {
  const terminals = useTerminalStore((state) => state.terminals);
  const createNewTerminal = useTerminalStore((state) => state.createNewTerminal);

  const handleNewTerminal = useCallback(async () => {
    const title = `Terminal ${terminals.length + 1}`;
    await createNewTerminal(title);
  }, [terminals.length, createNewTerminal]);

  const handleCloseTerminal = useCallback(async (id: string) => {
    await requestGuardedTerminalClose(id);
  }, []);

  return {
    handleNewTerminal,
    handleCloseTerminal,
  };
}
