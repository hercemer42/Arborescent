import { useSubmenuBehavior } from './useSubmenuBehavior';
import { ContextMenuItem } from '../ContextMenu';

interface SubmenuProps {
  items: ContextMenuItem[];
  onClose: () => void;
  emptyMessage?: string;
}

export function Submenu({ items, onClose, emptyMessage = 'No items available' }: SubmenuProps) {
  const {
    openSubmenu,
    handleItemClick,
  } = useSubmenuBehavior(onClose);

  if (items.length === 0) {
    return (
      <div className="context-menu-submenu">
        <div className="context-menu-item disabled">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div className="context-menu-submenu">
      {items.map((item, index) => (
        <div
          key={index}
          className="context-menu-item-wrapper"
        >
          <button
            className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.submenu ? 'has-submenu' : ''}`}
            onClick={() => handleItemClick(item, index)}
            disabled={item.disabled}
            title={item.disabled && item.disabledTooltip ? item.disabledTooltip : undefined}
          >
            {item.icon && <span className="context-menu-item-icon">{item.icon}</span>}
            <span className="context-menu-item-label">{item.label}</span>
            {item.submenu && <span className="context-menu-submenu-arrow">›</span>}
          </button>
          {item.submenu && openSubmenu === index && (
            <Submenu items={item.submenu} onClose={onClose} />
          )}
        </div>
      ))}
    </div>
  );
}
