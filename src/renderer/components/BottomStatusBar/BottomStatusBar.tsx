import { useState } from 'react';
import { useFlashMessage } from './hooks/useFlashMessage';
import { useFeedbackStatus } from './hooks/useFeedbackStatus';
import { useBlueprintModeStatus } from './hooks/useBlueprintModeStatus';
import { useActivityRecap } from './hooks/useActivityRecap';
import { ActivityLogPopover } from '../ui/ActivityLog/ActivityLogPopover';
import './BottomStatusBar.css';

type StatusType = 'flash' | 'blueprint' | 'default';

function useStatusBar(): { message: string; type: StatusType } | null {
  const flashMessage = useFlashMessage();
  const feedbackMessage = useFeedbackStatus();
  const blueprintModeEnabled = useBlueprintModeStatus();

  if (flashMessage) {
    return { message: flashMessage, type: 'flash' };
  }
  if (blueprintModeEnabled) {
    return { message: 'Blueprint Mode', type: 'blueprint' };
  }
  if (feedbackMessage) {
    return { message: feedbackMessage, type: 'default' };
  }
  return null;
}

const STATUS_CLASS_MAP: Record<StatusType, string> = {
  flash: 'bottom-status-bar-flash',
  blueprint: 'bottom-status-bar-blueprint',
  default: '',
};

function ActivityRecap() {
  const { latestEntry, unreadCount, openPanel } = useActivityRecap();
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);

  if (!latestEntry) return null;

  const label = unreadCount > 0 ? `Open activity log, ${unreadCount} unread` : 'Open activity log';
  const showPreview = () => setIsPreviewVisible(true);
  const hidePreview = () => setIsPreviewVisible(false);

  return (
    <div
      className="activity-recap"
      onMouseEnter={showPreview}
      onMouseLeave={hidePreview}
      onFocus={showPreview}
      onBlur={hidePreview}
    >
      {isPreviewVisible && <ActivityLogPopover />}
      <button type="button" className="activity-recap-button" onClick={openPanel} aria-label={label}>
        <span className={`activity-recap-message activity-log-entry--${latestEntry.type}`}>
          {latestEntry.message}
        </span>
        {unreadCount > 0 && <span className="activity-recap-unread">{unreadCount}</span>}
      </button>
    </div>
  );
}

export function BottomStatusBar() {
  const status = useStatusBar();

  const className = status
    ? `bottom-status-bar ${STATUS_CLASS_MAP[status.type]}`.trim()
    : 'bottom-status-bar';

  return (
    <div className={className}>
      {status && <span className="status-message">{status.message}</span>}
      <ActivityRecap />
    </div>
  );
}
