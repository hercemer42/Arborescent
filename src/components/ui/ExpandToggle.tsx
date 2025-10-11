import React from 'react';
import { theme, componentStyles } from '../../design/theme';

interface ExpandToggleProps {
  expanded: boolean;
  onToggle: () => void;
}

export function ExpandToggle({ expanded, onToggle }: ExpandToggleProps) {
  const icon = expanded ? theme.icons.collapse : theme.icons.expand;

  return (
    <button
      className={`${componentStyles.button.base} ${componentStyles.button.text} ${componentStyles.button.hover}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={expanded ? 'Collapse' : 'Expand'}
    >
      <span className={componentStyles.icon.small}>{icon}</span>
    </button>
  );
}
