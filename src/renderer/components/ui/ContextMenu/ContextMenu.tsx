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

  // Predict if submenus would need to flip based on menu's right edge
  // Use measured width if available, otherwise estimate
  const menuWidth = menuRef.current?.getBoundingClientRect().width ?? 150;
  const menuRight = position.x + menuWidth;
  const childWouldFlip = menuRight + SUBMENU_WIDTH > window.innerWidth;
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
        item.separator ? (
          <div key={index} className="context-menu-separator" />
        ) : (
          <div
            key={index}
            className="context-menu-item-wrapper"
          >
            <button
              className={`context-menu-item ${item.danger ? 'danger' : ''} ${item.submenu ? 'has-submenu' : ''} ${item.radioSelected !== undefined ? 'has-radio' : ''}`}
              onClick={() => handleItemClick(item, index)}
              disabled={item.disabled}
              title={item.disabled && item.disabledTooltip ? item.disabledTooltip : undefined}
            >
              {item.radioSelected !== undefined && (
                <span className="context-menu-item-radio">
                  {item.radioSelected ? '◉' : '○'}
                </span>
              )}
              {item.icon && <span className="context-menu-item-icon">{item.icon}</span>}
              <span className="context-menu-item-label">{item.label}</span>
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
