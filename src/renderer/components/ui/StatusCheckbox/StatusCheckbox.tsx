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
    // Don't toggle when modifier keys pressed (let parent handle node multi-selection)
    if (e.ctrlKey || e.metaKey || e.shiftKey) {
      return;
    }
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
      }}
      onClick={handleClick}
      aria-label={`Status: ${status}`}
    >
      {symbol}
    </button>
  );
}
