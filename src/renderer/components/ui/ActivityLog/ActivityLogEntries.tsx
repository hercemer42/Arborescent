import type { ActivityLogEntry } from '../../../store/activityLog/activityLogStore';
import { formatRelativeTime } from '../../../utils/relativeTime';

interface ActivityLogEntriesProps {
  entries: ActivityLogEntry[];
}

export function ActivityLogEntries({ entries }: ActivityLogEntriesProps) {
  const newestFirst = [...entries].reverse();

  return (
    <ul className="activity-log-list">
      {newestFirst.map((entry) => (
        <li key={entry.id} className={`activity-log-entry activity-log-entry--${entry.type}`}>
          <span className="activity-log-entry-message">{entry.message}</span>
          <time className="activity-log-entry-time">{formatRelativeTime(entry.timestamp)}</time>
        </li>
      ))}
    </ul>
  );
}
