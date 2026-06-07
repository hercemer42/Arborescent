import { ipcMain } from 'electron';
import { MAX_ACTIVITY_ENTRIES, type ActivityLogEntry } from '../../shared/types/activityLog';
import {
  appendActivityEntry,
  readRecentActivityEntries,
  trimActivityFile,
} from '../services/activityLogFile';

function isValidEntry(entry: unknown): entry is ActivityLogEntry {
  if (!entry || typeof entry !== 'object') return false;
  const candidate = entry as Partial<ActivityLogEntry>;
  return typeof candidate.id === 'string' && typeof candidate.message === 'string';
}

export function registerActivityLogHandlers(): void {
  ipcMain.handle('activity-log:append', async (_event, entry: ActivityLogEntry) => {
    if (!isValidEntry(entry)) return;
    appendActivityEntry(entry);
  });

  ipcMain.handle('activity-log:read-recent', async () => {
    trimActivityFile(MAX_ACTIVITY_ENTRIES);
    return readRecentActivityEntries(MAX_ACTIVITY_ENTRIES);
  });
}
