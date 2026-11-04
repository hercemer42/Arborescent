import { storeManager } from '../store/storeManager';
import { findStoreOwningSession } from '../store/storeOwnership';
import { useFilesStore } from '../store/files/filesStore';
import { usePanelStore } from '../store/panel/panelStore';
import { useTerminalStore } from '../store/terminal/terminalStore';
import { focusTerminal } from './terminalFocusRegistry';

// Brings a Claude session to the front from outside the app (a `Focus` hook event, sent by
// pr-radar's focus plugin): its file's tab, the terminal panel, then its terminal tab and the
// cursor in it. False when no open file has the session, so the caller can say so.
export function focusSession(sessionId: string): boolean {
  const store = findStoreOwningSession(sessionId);
  const terminalId = store?.getState().workflowSessionMap[sessionId];
  if (!store || !terminalId) return false;

  const filePath = storeManager.getAllStoreEntries().find((entry) => entry.store === store)?.filePath;
  // Switching files is what moves the panel and terminal stores to that file's terminals.
  if (filePath) useFilesStore.getState().setActiveFile(filePath);
  usePanelStore.getState().showTerminal();
  useTerminalStore.getState().setActiveTerminal(terminalId);
  focusTerminal(terminalId);
  return true;
}
