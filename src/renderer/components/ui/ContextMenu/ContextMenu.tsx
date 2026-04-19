import { createPortal } from 'react-dom';
import { useContextMenuBehavior } from './hooks/useContextMenuBehavior';
import { useMenuPosition } from './hooks/useMenuPosition';
import { Submenu } from './Submenu';
import './ContextMenu.css';

export interface ContextMenuItem {
  label?: string;
  onClick?: () => void;
  danger?: boolean;
  disabled?: boolean;
  disabledTooltip?: string;
  submenu?: ContextMenuItem[];
  icon?: React.ReactNode;
  radioSelected?: boolean;
  keepOpenOnClick?: boolean;
  separator?: boolean;
  shortcut?: string;
  tooltip?: string;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

// Typical submenu width for predicting overflow
const SUBMENU_WIDTH = 200;

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const {
    menuRef,
    openSubmenu,
    handleItemClick,
  } = useContextMenuBehavior(onClose);

  const position = useMenuPosition(menuRef, x, y);

  // Derive submenu flip direction from measured menu width
  const childWouldFlip = position.measured && (position.x + position.menuWidth + SUBMENU_WIDTH > window.innerWidth);
  const arrow = childWouldFlip ? '‹' : '›';

  return createPortal(
    <div
      ref={menuRef}
      className="context-menu"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        visibility: position.measured ? 'visible' : 'hidden',
      }}
    >
      {items.map((item, index) => (
        item.separator || item.label === '-' ? (
          <div key={index} className="context-menu-separator" role="separator" aria-orientation="horizontal" />
        ) : (
          <div
            key={index}
            className="context-menu-item-wrapper"
          >
            <button
              className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.submenu ? 'has-submenu' : ''} ${item.radioSelected !== undefined ? 'has-radio' : ''}`}
              onClick={() => handleItemClick(item, index)}
              disabled={item.disabled}
              title={item.disabled && item.disabledTooltip ? item.disabledTooltip : item.tooltip || undefined}
            >
              {item.radioSelected !== undefined && (
                <span className="context-menu-item-radio">
                  {item.radioSelected ? '◉' : '○'}
                </span>
              )}
              {item.icon && <span className="context-menu-item-icon">{item.icon}</span>}
              <span className="context-menu-item-label">{item.label}</span>
              {item.shortcut && !item.submenu && (
                <span className="context-menu-item-shortcut">{item.shortcut}</span>
              )}
              {item.submenu && <span className="context-menu-submenu-arrow">{arrow}</span>}
            </button>
            {item.submenu && openSubmenu === index && (
              <Submenu items={item.submenu} onClose={onClose} />
            )}
          </div>
        )
      ))}
    </div>,
    document.body
  );
}
