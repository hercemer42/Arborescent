import { memo } from 'react';
import { ClipboardCheck } from 'lucide-react';
import './Tab.css';

interface TabProps {
  displayName: string;
  fullName?: string;
  isActive: boolean;
  isBlueprintMode?: boolean;
  isSummaryMode?: boolean;
  isZoomTab?: boolean;
  isLastInGroup?: boolean;
  hasZoomToRight?: boolean;
  onClick: () => void;
  onClose: () => void;
}

export const Tab = memo(function Tab({
  displayName,
  fullName,
  isActive,
  isBlueprintMode,
  isSummaryMode,
  isZoomTab,
  isLastInGroup,
  hasZoomToRight,
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
    isActive && isBlueprintMode && 'blueprint-mode',
    isActive && isSummaryMode && 'summary-mode',
    isZoomTab && 'zoom-tab',
    isZoomTab && isLastInGroup && 'zoom-tab-last',
    hasZoomToRight && 'has-zoom-right',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      onClick={onClick}
      title={fullName || displayName}
    >
      {isZoomTab && <span className="tab-zoom-icon">🔍</span>}
      {isSummaryMode && <ClipboardCheck size={12} className="tab-summary-icon" />}
      <span className="tab-name">{displayName}</span>
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
