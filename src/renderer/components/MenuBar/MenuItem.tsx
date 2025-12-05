import { Check } from 'lucide-react';
import { useMenuItem } from './hooks';

interface MenuItemProps {
  label: string;
  shortcut?: string;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  checked?: boolean;
}

export function MenuItem({ label, shortcut, onClick, disabled, danger, checked }: MenuItemProps) {
  const { handleClick, handleKeyDown } = useMenuItem({ onClick, disabled });
  const hasCheckbox = checked !== undefined;

  return (
    <button
      className={`menu-item ${danger ? 'danger' : ''} ${hasCheckbox ? 'has-checkbox' : ''}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      disabled={disabled}
      role="menuitem"
      tabIndex={-1}
    >
      {hasCheckbox && (
        <span className="menu-item-checkbox">
          {checked && <Check size={14} />}
        </span>
      )}
      <span className="menu-item-label">{label}</span>
      {shortcut && <span className="menu-item-shortcut">{shortcut}</span>}
    </button>
  );
}
