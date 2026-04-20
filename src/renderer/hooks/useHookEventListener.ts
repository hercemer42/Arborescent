import { useEffect } from 'react';
import { storeManager } from '../store/storeManager';
import { logger } from '../services/logger';

export function useHookEventListener(): void {
  useEffect(() => {
    const cleanup = window.electron.onHookEvent((event) => {
      logger.info(`Hook event received in renderer: ${event.hook_event_name} (session=${event.session_id}${event.terminal_id ? `, terminal=${event.terminal_id}` : ''})`, 'HookEventListener');

      const stores = storeManager.getAllStores();

      if (event.hook_event_name === 'SessionStart' && event.terminal_id) {
        for (const store of stores) {
          store.getState().actions.registerSession(event.session_id, event.terminal_id, event.source);
        }
      } else {
        for (const store of stores) {
          store.getState().actions.handleHookEvent(event);
        }
      }
    });

    return cleanup;
  }, []);
}
