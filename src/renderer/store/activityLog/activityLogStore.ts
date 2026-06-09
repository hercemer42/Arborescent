import { create } from 'zustand';
import type { ToastType } from '../../components/ui/Toast';
import {
  type ActivityLogEntry,
  MAX_ACTIVITY_ENTRIES,
} from '../../../shared/types/activityLog';
import {
  persistActivityEntry,
  loadRecentActivityEntries,
} from '../../services/activityLogPersistence';

export { MAX_ACTIVITY_ENTRIES };
export type { ActivityLogEntry };

interface ActivityLogState {
  entries: ActivityLogEntry[];
  addEntry: (message: string, type: ToastType, source?: string, sessionId?: string) => void;
  hydrate: (entries: ActivityLogEntry[]) => void;
}

function createEntry(message: string, type: ToastType, source?: string, sessionId?: string): ActivityLogEntry {
  return {
    id: `${Date.now()}-${Math.random()}`,
    message,
    type,
    source,
    timestamp: Date.now(),
    sessionId,
  };
}

export const useActivityLogStore = create<ActivityLogState>((set) => ({
  entries: [],

  addEntry: (message, type, source, sessionId) => {
    const entry = createEntry(message, type, source, sessionId);
    set((state) => ({ entries: [...state.entries, entry].slice(-MAX_ACTIVITY_ENTRIES) }));
    persistActivityEntry(entry);
  },

  hydrate: (entries) => {
    set({ entries: entries.slice(-MAX_ACTIVITY_ENTRIES) });
  },
}));

export async function hydrateActivityLog(): Promise<void> {
  const entries = await loadRecentActivityEntries();
  useActivityLogStore.getState().hydrate(entries);
}
