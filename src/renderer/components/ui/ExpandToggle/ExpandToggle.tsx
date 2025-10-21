import './ExpandToggle.css';

interface ExpandToggleProps {
  expanded: boolean;
  onToggle: () => void;
  isSelected: boolean;
}

const ICONS = {
  expand: '▶',
  collapse: '▼',
};

export function ExpandToggle({ expanded, onToggle, isSelected }: ExpandToggleProps) {
  const icon = expanded ? ICONS.collapse : ICONS.expand;

  if (!isSelected) return null;

  return (
    <button
      className="expand-toggle"
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onClick={(e) => {
        e.stopPropagation();
        onToggle();
      }}
      aria-label={expanded ? 'Collapse' : 'Expand'}
    >
      <span className="expand-toggle-icon" onMouseDown={(e) => e.preventDefault()}>
        {icon}
      </span>
    </button>
  );
}
