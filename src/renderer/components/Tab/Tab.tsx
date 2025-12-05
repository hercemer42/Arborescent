import { memo } from 'react';
import './Tab.css';

interface TabProps {
  displayName: string;
  isActive: boolean;
  isBlueprintMode?: boolean;
  onClick: () => void;
  onClose: () => void;
}

export const Tab = memo(function Tab({
  displayName,
  isActive,
  isBlueprintMode,
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
  ].filter(Boolean).join(' ');

  return (
    <div
      className={classNames}
      onClick={onClick}
      title={displayName}
    >
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
