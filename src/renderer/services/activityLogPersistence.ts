import type { ActivityLogEntry } from '../../shared/types/activityLog';

export function persistActivityEntry(entry: ActivityLogEntry): void {
  if (typeof window.electron.appendActivityLog === 'function') {
    void window.electron.appendActivityLog(entry);
  }
}

export function loadRecentActivityEntries(): Promise<ActivityLogEntry[]> {
  if (typeof window.electron.readRecentActivityLog === 'function') {
    return window.electron.readRecentActivityLog();
  }
  return Promise.resolve([]);
}
