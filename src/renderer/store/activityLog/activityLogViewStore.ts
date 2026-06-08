import { create } from 'zustand';
import { useActivityLogStore } from './activityLogStore';

interface ActivityLogViewState {
  isPanelOpen: boolean;
  lastSeenTimestamp: number;
  openPanel: () => void;
  closePanel: () => void;
  togglePanel: () => void;
}

function latestEntryTimestamp(): number {
  const { entries } = useActivityLogStore.getState();
  return entries.length > 0 ? entries[entries.length - 1].timestamp : 0;
}

export const useActivityLogViewStore = create<ActivityLogViewState>((set, get) => ({
  isPanelOpen: false,
  lastSeenTimestamp: 0,

  openPanel: () => set({ isPanelOpen: true, lastSeenTimestamp: latestEntryTimestamp() }),
  closePanel: () => set({ isPanelOpen: false }),
  togglePanel: () => {
    const { isPanelOpen, openPanel, closePanel } = get();
    if (isPanelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  },
}));
