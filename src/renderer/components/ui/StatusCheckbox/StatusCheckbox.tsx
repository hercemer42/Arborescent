import React from 'react';
import { NodeStatus, STATUS_SYMBOLS } from '../../../../shared/types';
import './StatusCheckbox.css';

interface StatusCheckboxProps {
  status?: NodeStatus;
  onToggle?: () => void;
}

export function StatusCheckbox({ status, onToggle }: StatusCheckboxProps) {
  if (!status) {
    return null;
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onToggle) {
      onToggle();
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
