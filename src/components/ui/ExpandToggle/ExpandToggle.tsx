import React from 'react';
import { ICONS, styles } from './ExpandToggle.styles';

interface ExpandToggleProps {
  expanded: boolean;
  onToggle: () => void;
}

export function ExpandToggle({ expanded, onToggle }: ExpandToggleProps) {
  const icon = expanded ? ICONS.collapse : ICONS.expand;

  return (
    <button
      className={styles.button}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={expanded ? 'Collapse' : 'Expand'}
    >
      <span className={styles.icon}>{icon}</span>
    </button>
  );
}
