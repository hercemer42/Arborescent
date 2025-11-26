import { useEffect, useRef, useState } from 'react';
import './ContextMenu.css';

export interface ContextMenuItem {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  submenu?: ContextMenuItem[];
  icon?: React.ReactNode;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [openSubmenu, setOpenSubmenu] = useState<number | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleItemClick = (item: ContextMenuItem) => {
    if (item.submenu) {
      return; // Don't close menu when clicking on submenu parent
    }
    if (item.onClick) {
      item.onClick();
    }
    onClose();
  };

  const handleSubmenuItemClick = (item: ContextMenuItem) => {
    if (item.onClick) {
      item.onClick();
    }
    onClose();
  };

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: `${x}px`, top: `${y}px` }}
    >
      {items.map((item, index) => (
        <div
          key={index}
          className="context-menu-item-wrapper"
          onMouseEnter={() => item.submenu && setOpenSubmenu(index)}
          onMouseLeave={() => item.submenu && setOpenSubmenu(null)}
        >
          <button
            className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.submenu ? 'has-submenu' : ''}`}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
          >
            {item.icon && <span className="context-menu-item-icon">{item.icon}</span>}
            <span className="context-menu-item-label">{item.label}</span>
            {item.submenu && <span className="context-menu-submenu-arrow">›</span>}
          </button>
          {item.submenu && openSubmenu === index && (
            <div className="context-menu-submenu">
              {item.submenu.length === 0 ? (
                <div className="context-menu-item disabled">No contexts available</div>
              ) : (
                item.submenu.map((subItem, subIndex) => (
                  <button
                    key={subIndex}
                    className={`context-menu-item ${subItem.danger ? 'danger' : ''}`}
                    onClick={() => handleSubmenuItemClick(subItem)}
                    disabled={subItem.disabled}
                  >
                    {subItem.icon && <span className="context-menu-item-icon">{subItem.icon}</span>}
                    <span className="context-menu-item-label">{subItem.label}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
