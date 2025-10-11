import React from 'react';
import { NodeStatus } from '../../types';
import { componentStyles } from '../../design/theme';

interface StatusCheckboxProps {
  status?: NodeStatus;
  onChange?: (status: NodeStatus) => void;
}

export function StatusCheckbox({ status, onChange }: StatusCheckboxProps) {
  if (!status) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onChange) {
      const statusCycle: NodeStatus[] = ['☐', '✓', '✗'];
      const currentIndex = statusCycle.indexOf(status);
      const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
      onChange(nextStatus);
    }
  };

  return (
    <button
      className={`${componentStyles.icon.base} cursor-pointer hover:opacity-70 transition-opacity`}
      onClick={handleClick}
      aria-label={`Status: ${status}`}
    >
      {status}
    </button>
  );
}
