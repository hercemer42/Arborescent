import { memo } from 'react';
import './Tab.css';

interface TabProps {
  displayName: string;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}

export const Tab = memo(function Tab({
  displayName,
  isActive,
  onClick,
  onClose,
}: TabProps) {
  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    onClose();
  };

  return (
    <div
      className={`tab ${isActive ? 'active' : ''}`}
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
