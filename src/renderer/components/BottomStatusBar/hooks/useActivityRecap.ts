import { useActivityLogStore } from '../../../store/activityLog/activityLogStore';
import { useActivityLogViewStore } from '../../../store/activityLog/activityLogViewStore';
import type { ActivityLogEntry } from '../../../store/activityLog/activityLogStore';

interface ActivityRecap {
  latestEntry: ActivityLogEntry | null;
  unreadCount: number;
  openPanel: () => void;
}

export function useActivityRecap(): ActivityRecap {
  const entries = useActivityLogStore((state) => state.entries);
  const lastSeenTimestamp = useActivityLogViewStore((state) => state.lastSeenTimestamp);
  const openPanel = useActivityLogViewStore((state) => state.openPanel);

  const latestEntry = entries.length > 0 ? entries[entries.length - 1] : null;
  const unreadCount = entries.reduce((count, entry) => (entry.timestamp > lastSeenTimestamp ? count + 1 : count), 0);

  return { latestEntry, unreadCount, openPanel };
}
