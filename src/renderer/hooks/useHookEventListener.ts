import { useEffect } from 'react';
import { useTerminalStore } from '../store/terminal/terminalStore';
import { logger } from '../services/logger';
import { findStoreOwningSession, findStoreOwningTerminal } from '../store/storeOwnership';

export function useHookEventListener(): void {
  useEffect(() => {
    const cleanup = window.electron.onHookEvent((event) => {
      logger.info(
        `Hook event received in renderer: ${event.hook_event_name} (session=${event.session_id}${event.terminal_id ? `, terminal=${event.terminal_id}` : ''})`,
        'HookEventListener',
      );

      if (event.terminal_id) {
        if (event.hook_event_name === 'UserPromptSubmit') {
          useTerminalStore.getState().markTerminalProcessing(event.terminal_id, true);
        } else if (event.hook_event_name === 'Stop') {
          useTerminalStore.getState().markTerminalProcessing(event.terminal_id, false);
        }
      }

      if (event.hook_event_name === 'SessionStart' || event.hook_event_name === 'session-terminal-mapping') {
        if (!event.terminal_id) {
          logger.warn(
            `${event.hook_event_name} dropped — no terminal_id provided (session=${event.session_id})`,
            'HookEventListener',
          );
          return;
        }
        const store = findStoreOwningTerminal(event.terminal_id);
        if (!store) {
          logger.warn(
            `${event.hook_event_name} dropped — no open file owns terminal ${event.terminal_id}`,
            'HookEventListener',
          );
          return;
        }
        store.getState().actions.registerSession(event.session_id, event.terminal_id, event.source);
        return;
      }

      const store =
        findStoreOwningSession(event.session_id) ??
        (event.terminal_id ? findStoreOwningTerminal(event.terminal_id) : null);
      if (!store) {
        logger.warn(
          `${event.hook_event_name} dropped — no store has session ${event.session_id} registered and no terminal_id fallback resolved`,
          'HookEventListener',
        );
        return;
      }
      store.getState().actions.handleHookEvent(event);
    });

    return cleanup;
  }, []);
}
