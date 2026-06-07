import { useActivityLogStore } from '../../../store/activityLog/activityLogStore';
import { ActivityLogEntries } from './ActivityLogEntries';
import './ActivityLog.css';

const POPOVER_ENTRY_COUNT = 5;

export function ActivityLogPopover() {
  const entries = useActivityLogStore((state) => state.entries);
  const recent = entries.slice(-POPOVER_ENTRY_COUNT);

  return (
    <div className="activity-log-popover" role="log" aria-label="Recent workflow activity">
      <ActivityLogEntries entries={recent} />
    </div>
  );
}
