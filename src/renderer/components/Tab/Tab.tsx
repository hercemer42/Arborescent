import { memo } from 'react';
import { ClipboardCheck } from 'lucide-react';
import './Tab.css';

export type TabIndicatorType = 'actionRequired' | 'feedbackPending' | 'workflowRunning' | null;

interface TabProps {
  displayName: string;
  fullName?: string;
  isActive: boolean;
  isAssociated?: boolean;
  isBlueprintMode?: boolean;
  isSummaryMode?: boolean;
  isZoomTab?: boolean;
  isLastInGroup?: boolean;
  hasZoomToRight?: boolean;
  isReviewPending?: boolean;
  indicator?: TabIndicatorType;
  onClick: () => void;
  onClose: () => void;
}

const INDICATOR_TITLES: Record<string, string> = {
  actionRequired: 'Action required',
  feedbackPending: 'Feedback pending',
  workflowRunning: 'Workflow running',
};

export const Tab = memo(function Tab({
  displayName,
  fullName,
  isActive,
  isAssociated,
  isBlueprintMode,
  isSummaryMode,
  isZoomTab,
  isLastInGroup,
  hasZoomToRight,
  isReviewPending,
  indicator,
  onClick,
  onClose,
}: TabProps) {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  const classNames = [
    'tab',
    isActive && 'active',
    !isActive && isAssociated && 'associated',
    isActive && isBlueprintMode && 'blueprint-mode',
    isActive && isSummaryMode && 'summary-mode',
    isZoomTab && 'zoom-tab',
    isZoomTab && isLastInGroup && 'zoom-tab-last',
    hasZoomToRight && 'has-zoom-right',
    !isActive && isReviewPending && 'review-pending',
  ].filter(Boolean).join(' ');

  const showIndicator = !isActive && indicator;
  const baseTitle = fullName || displayName;
  const title = !isActive && isReviewPending ? `${baseTitle} — review feedback pending` : baseTitle;

  return (
    <div
      className={classNames}
      onClick={onClick}
      title={title}
    >
      {isZoomTab && <span className="tab-zoom-icon">🔍</span>}
      {isSummaryMode && <ClipboardCheck size={12} className="tab-summary-icon" />}
      <span className="tab-name">{displayName}</span>
      {showIndicator && (
        <span
          className={`tab-indicator tab-indicator-${indicator}`}
          title={INDICATOR_TITLES[indicator]}
          aria-label={INDICATOR_TITLES[indicator]}
        />
      )}
      <button
        className="tab-close"
        onClick={handleClose}
        aria-label="Close tab"
      >
        ×
      </button>
    </div>
  );
});
