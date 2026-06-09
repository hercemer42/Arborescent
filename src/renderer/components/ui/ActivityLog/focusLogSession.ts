import { storeManager } from '../../../store/storeManager';
import { useTerminalStore } from '../../../store/terminal/terminalStore';
import { useFilesStore } from '../../../store/files/filesStore';

interface SessionTarget {
  filePath: string;
  terminalId: string;
}

// Session bindings live in each open file's tree store, so the file that holds
// the binding is also the file whose tab to surface. Resolving at click time
// keeps the target correct after a session resumes onto a fresh terminal id.
function resolveSessionTarget(sessionId: string): SessionTarget | null {
  for (const { filePath, store } of storeManager.getAllStoreEntries()) {
    const terminalId = store.getState().workflowSessionMap[sessionId];
    if (terminalId) return { filePath, terminalId };
  }
  return null;
}

function terminalIsOpen(filePath: string, terminalId: string): boolean {
  const fileState = useTerminalStore.getState().fileStates[filePath];
  return fileState?.terminals.some((terminal) => terminal.id === terminalId) ?? false;
}

export function focusLogSession(sessionId: string): boolean {
  const target = resolveSessionTarget(sessionId);
  if (!target || !terminalIsOpen(target.filePath, target.terminalId)) return false;

  useFilesStore.getState().setActiveFile(target.filePath);
  useTerminalStore.getState().setActiveTerminal(target.terminalId);
  return true;
}
