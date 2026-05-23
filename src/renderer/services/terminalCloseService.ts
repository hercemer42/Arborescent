import { useTerminalStore } from '../store/terminal/terminalStore';
import { usePendingTerminalCloseStore } from '../store/pendingTerminalCloseStore';
import { storeManager } from '../store/storeManager';
import { logger } from './logger';

async function disposeTerminal(id: string): Promise<void> {
  const { closeTerminal } = useTerminalStore.getState();
  await closeTerminal(id);
  for (const store of storeManager.getAllStores()) {
    store.getState().actions.handleTerminalClosed(id);
  }
}

function findTerminalTitle(id: string): string {
  const state = useTerminalStore.getState();
  const direct = state.terminals.find((t) => t.id === id);
  if (direct) return direct.title;
  for (const fileState of Object.values(state.fileStates)) {
    const match = fileState.terminals.find((t) => t.id === id);
    if (match) return match.title;
  }
  return 'Terminal';
}

export async function requestGuardedTerminalClose(id: string): Promise<void> {
  if (!id) return;
  const state = useTerminalStore.getState();
  if (!state.isTerminalProcessing(id)) {
    await disposeTerminal(id);
    return;
  }

  const pending = usePendingTerminalCloseStore.getState();
  if (pending.current) {
    logger.info(
      `Terminal close request for ${id} dropped — confirmation already pending for ${pending.current.terminalId}`,
      'TerminalCloseService',
    );
    return;
  }

  pending.requestClose({
    terminalId: id,
    terminalTitle: findTerminalTitle(id),
    onConfirm: async () => {
      usePendingTerminalCloseStore.getState().clear();
      await disposeTerminal(id);
    },
    onCancel: () => {
      usePendingTerminalCloseStore.getState().clear();
    },
  });
}
