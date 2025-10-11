import React from 'react';
import './ExpandToggle.css';

interface ExpandToggleProps {
  expanded: boolean;
  onToggle: () => void;
}

const ICONS = {
  expand: '▶',
  collapse: '▼',
};

export function ExpandToggle({ expanded, onToggle }: ExpandToggleProps) {
  const icon = expanded ? ICONS.collapse : ICONS.expand;

  return (
    <button
      className="expand-toggle"
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={expanded ? 'Collapse' : 'Expand'}
    >
      <span className="expand-toggle-icon">{icon}</span>
    </button>
  );
}
