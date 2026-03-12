import { useEffect } from 'react';
import { storeManager } from '../store/storeManager';

export function useHookEventListener(): void {
  useEffect(() => {
    const cleanup = window.electron.onHookEvent((event) => {
      const stores = storeManager.getAllStores();

      if (event.hook_event_name === 'SessionStart' && event.terminal_id) {
        for (const store of stores) {
          store.getState().actions.registerSession(event.session_id, event.terminal_id);
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
