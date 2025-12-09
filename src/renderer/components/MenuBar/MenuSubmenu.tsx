import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { useSubmenuHover } from './hooks/useSubmenuHover';

interface MenuSubmenuProps {
  label: string;
  children: ReactNode;
  disabled?: boolean;
}

export function MenuSubmenu({ label, children, disabled }: MenuSubmenuProps) {
  const { isOpen, submenuRef, handleMouseEnter, handleMouseLeave } = useSubmenuHover({
    disabled,
  });

  return (
    <div
      ref={submenuRef}
      className="menu-submenu-wrapper"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={`menu-item has-submenu ${disabled ? 'disabled' : ''}`}
        disabled={disabled}
        role="menuitem"
        tabIndex={-1}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <span className="menu-item-label">{label}</span>
        <ChevronRight size={14} className="menu-submenu-arrow" />
      </button>
      {isOpen && (
        <div className="menu-submenu" role="menu">
          {children}
        </div>
      )}
    </div>
  );
}
