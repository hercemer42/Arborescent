import { useEffect } from 'react';
import { storeManager } from '../store/storeManager';
import { useTerminalStore } from '../store/terminal/terminalStore';
import { logger } from '../services/logger';
import type { TreeStore } from '../store/tree/treeStore';

function findStoreOwningTerminal(terminalId: string): TreeStore | null {
  const { fileStates } = useTerminalStore.getState();
  for (const [filePath, state] of Object.entries(fileStates)) {
    if (state.terminals.some((t) => t.id === terminalId)) {
      return storeManager.getAllStoreEntries().find((e) => e.filePath === filePath)?.store ?? null;
    }
  }
  return null;
}

function findStoreOwningSession(sessionId: string): TreeStore | null {
  for (const { store } of storeManager.getAllStoreEntries()) {
    const map = store.getState().workflowSessionMap;
    if (map && Object.prototype.hasOwnProperty.call(map, sessionId)) {
      return store;
    }
  }
  return null;
}

export function useHookEventListener(): void {
  useEffect(() => {
    const cleanup = window.electron.onHookEvent((event) => {
      logger.info(
        `Hook event received in renderer: ${event.hook_event_name} (session=${event.session_id}${event.terminal_id ? `, terminal=${event.terminal_id}` : ''})`,
        'HookEventListener',
      );

      if (event.hook_event_name === 'SessionStart') {
        if (!event.terminal_id) {
          logger.warn(
            `SessionStart dropped — no terminal_id provided (session=${event.session_id})`,
            'HookEventListener',
          );
          return;
        }
        const store = findStoreOwningTerminal(event.terminal_id);
        if (!store) {
          logger.warn(
            `SessionStart dropped — no open file owns terminal ${event.terminal_id}`,
            'HookEventListener',
          );
          return;
        }
        store.getState().actions.registerSession(event.session_id, event.terminal_id, event.source);
        return;
      }

      const store = findStoreOwningSession(event.session_id);
      if (!store) {
        logger.warn(
          `${event.hook_event_name} dropped — no store has session ${event.session_id} registered`,
          'HookEventListener',
        );
        return;
      }
      store.getState().actions.handleHookEvent(event);
    });

    return cleanup;
  }, []);
}
