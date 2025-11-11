import './ExpandToggle.css';

interface ExpandToggleProps {
  expanded: boolean;
  onToggle: () => void;
}

const ICONS = {
  expand: '›',
  collapse: '⌄',
};

export function ExpandToggle({ expanded, onToggle }: ExpandToggleProps) {
  const icon = expanded ? ICONS.collapse : ICONS.expand;

  return (
    <button
      className={`expand-toggle ${expanded ? 'expanded' : 'collapsed'}`}
      onMouseDown={(e) => {
        e.preventDefault();
      }}
      onClick={(e) => {
        // Don't toggle when modifier keys pressed (let parent handle node multi-selection)
        if (e.ctrlKey || e.metaKey || e.shiftKey) {
          return;
        }
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
