import { useMenuItem } from './hooks';

interface MenuItemProps {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}

export function MenuItem({ label, shortcut, onClick, disabled, danger }: MenuItemProps) {
  const { handleClick, handleKeyDown } = useMenuItem({ onClick, disabled });

  return (
    <button
      className={`menu-item ${danger ? 'danger' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      role="menuitem"
      tabIndex={-1}
    >
      <span className="menu-item-label">{label}</span>
      {shortcut && <span className="menu-item-shortcut">{shortcut}</span>}
    </button>
  );
}
