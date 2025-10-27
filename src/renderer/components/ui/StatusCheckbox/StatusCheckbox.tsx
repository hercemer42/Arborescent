import React from 'react';
import { NodeStatus, STATUS_SYMBOLS } from '../../../../shared/types';
import './StatusCheckbox.css';

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
      const statusCycle: NodeStatus[] = ['pending', 'completed', 'failed'];
      const currentIndex = statusCycle.indexOf(status);
      const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];
      onChange(nextStatus);
    }
  };

  const symbol = STATUS_SYMBOLS[status];

  return (
    <button
      className="status-checkbox"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={handleClick}
      aria-label={`Status: ${status}`}
    >
      {symbol}
    </button>
  );
}
