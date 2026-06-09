import { useCallback, useEffect } from 'react';
import { useActivityLogStore, type ActivityLogEntry } from '../../../store/activityLog/activityLogStore';
import { ActivityLogEntries } from './ActivityLogEntries';
import { focusLogSession } from './focusLogSession';
import './ActivityLog.css';

interface ActivityLogPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ActivityLogPanel({ isOpen, onClose }: ActivityLogPanelProps) {
  const entries = useActivityLogStore((state) => state.entries);

  const activateEntry = useCallback((entry: ActivityLogEntry) => {
    if (entry.sessionId && focusLogSession(entry.sessionId)) onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <aside className="activity-log-panel" aria-label="Workflow activity log">
      <div className="activity-log-panel-header">
        <span className="activity-log-panel-title">Activity</span>
        <button
          type="button"
          className="activity-log-panel-close"
          onClick={onClose}
          aria-label="Close activity log"
        >
          ×
        </button>
      </div>
      <div className="activity-log-panel-scroll" role="log" aria-live="polite">
        {entries.length === 0 ? (
          <p className="activity-log-empty">No activity yet</p>
        ) : (
          <ActivityLogEntries entries={entries} interactive onActivateEntry={activateEntry} />
        )}
      </div>
    </aside>
  );
}
