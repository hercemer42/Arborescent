import type { ActivityLogEntry } from '../../../store/activityLog/activityLogStore';
import { formatRelativeTime } from '../../../utils/relativeTime';

interface ActivityLogEntriesProps {
  entries: ActivityLogEntry[];
  interactive?: boolean;
  onActivateEntry?: (entry: ActivityLogEntry) => void;
}

export function ActivityLogEntries({ entries, interactive = false, onActivateEntry }: ActivityLogEntriesProps) {
  const newestFirst = [...entries].reverse();

  return (
    <ul className="activity-log-list">
      {newestFirst.map((entry) => (
        <li key={entry.id} className={`activity-log-entry activity-log-entry--${entry.type}`}>
          {interactive && entry.sessionId && onActivateEntry ? (
            <button
              type="button"
              className="activity-log-entry-message activity-log-entry-action"
              title={entry.message}
              onClick={() => onActivateEntry(entry)}
            >
              {entry.message}
            </button>
          ) : (
            <span className="activity-log-entry-message" title={entry.message}>{entry.message}</span>
          )}
          <time className="activity-log-entry-time">{formatRelativeTime(entry.timestamp)}</time>
        </li>
      ))}
    </ul>
  );
}
