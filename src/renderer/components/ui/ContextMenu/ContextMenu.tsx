import { useContextMenuBehavior } from './hooks/useContextMenuBehavior';
import './ContextMenu.css';

export interface ContextMenuItem {
  label: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  disabledTooltip?: string;
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
  const {
    menuRef,
    openSubmenu,
    handleItemClick,
    handleSubmenuItemClick,
    handleSubmenuEnter,
    handleSubmenuLeave,
  } = useContextMenuBehavior(onClose);

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
          onMouseEnter={() => item.submenu && !item.disabled && handleSubmenuEnter(index)}
          onMouseLeave={() => item.submenu && !item.disabled && handleSubmenuLeave()}
        >
          <button
            className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.submenu ? 'has-submenu' : ''}`}
            onClick={() => handleItemClick(item)}
            disabled={item.disabled}
            title={item.disabled && item.disabledTooltip ? item.disabledTooltip : undefined}
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
