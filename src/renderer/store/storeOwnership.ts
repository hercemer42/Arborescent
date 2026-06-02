import { storeManager } from './storeManager';
import { useTerminalStore } from './terminal/terminalStore';
import type { TreeStore } from './tree/treeStore';

export function findStoreOwningTerminal(terminalId: string): TreeStore | null {
  const { fileStates } = useTerminalStore.getState();
  for (const [filePath, state] of Object.entries(fileStates)) {
    if (state.terminals.some((t) => t.id === terminalId)) {
      return storeManager.getAllStoreEntries().find((e) => e.filePath === filePath)?.store ?? null;
    }
  }
  return null;
}

export function findStoreOwningSession(sessionId: string): TreeStore | null {
  if (!sessionId) return null;
  for (const { store } of storeManager.getAllStoreEntries()) {
    const map = store.getState().workflowSessionMap;
    if (map && Object.prototype.hasOwnProperty.call(map, sessionId)) {
      return store;
    }
  }
  return null;
}
