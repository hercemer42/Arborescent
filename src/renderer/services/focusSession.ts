import { storeManager } from '../store/storeManager';
import { findStoreOwningSession } from '../store/storeOwnership';
import { useFilesStore } from '../store/files/filesStore';
import { usePanelStore } from '../store/panel/panelStore';
import { useTerminalStore } from '../store/terminal/terminalStore';
import { focusTerminal } from './terminalFocusRegistry';
import { waitForShellPrompt } from './shellPromptReadiness';

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

// Typed into a shell, so only a session id and an absolute directory get that far.
const SESSION_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Brings a Claude session forward from outside the app (a `Resume` hook event), whether or not it
// runs: its terminal tab when an open file has one, resumed there only when the tab is back at its
// shell, since a tab with anything in front (the session itself, most often) is only shown. A
// session no open file has opens in a new tab of the active file, in its directory, resumed.
export async function resumeSession(sessionId: string, cwd: string | undefined): Promise<boolean> {
  if (!SESSION_ID.test(sessionId)) return false;
  const mapped = findStoreOwningSession(sessionId)?.getState().workflowSessionMap[sessionId];
  if (mapped && focusSession(sessionId)) {
    if (await window.electron.terminalShellInFront(mapped)) await window.electron.terminalWrite(mapped, `claude --resume ${sessionId}\r`);
    return true;
  }

  if (!cwd || !cwd.startsWith('/') || !useFilesStore.getState().activeFilePath) return false;
  usePanelStore.getState().showTerminal();
  const created = await useTerminalStore.getState().createNewTerminal(undefined, cwd);
  if (!created) return false;
  useTerminalStore.getState().setActiveTerminal(created.id);
  if (await waitForShellPrompt(created.id)) await window.electron.terminalWrite(created.id, `claude --resume ${sessionId}\r`);
  focusTerminal(created.id);
  return true;
}
