import { useRef } from 'react';
import { useSubmenuBehavior } from './useSubmenuBehavior';
import { useSubmenuPosition } from './useSubmenuPosition';
import { ContextMenuItem } from '../types';

// Typical submenu width for predicting overflow
const SUBMENU_WIDTH = 200;

interface SubmenuProps {
  items: ContextMenuItem[];
  onClose: () => void;
  emptyMessage?: string;
}

export function Submenu({ items, onClose, emptyMessage = 'No items available' }: SubmenuProps) {
  const submenuRef = useRef<HTMLDivElement>(null);
  const {
    openSubmenu,
    handleItemClick,
  } = useSubmenuBehavior(onClose);
  const { flipHorizontal, flipVertical, submenuRight, maxHeight } = useSubmenuPosition(submenuRef);

  const childWouldFlip = submenuRight > 0 && (submenuRight + SUBMENU_WIDTH > window.innerWidth);
  const arrow = childWouldFlip ? '‹' : '›';

  const classNames = [
    'context-menu-submenu',
    flipHorizontal && 'flip-horizontal',
    flipVertical && 'flip-vertical',
  ].filter(Boolean).join(' ');

  const style = maxHeight !== undefined ? { maxHeight: `${maxHeight}px` } : undefined;

  if (items.length === 0) {
    return (
      <div ref={submenuRef} className={classNames} style={style}>
        <div className="context-menu-item disabled">{emptyMessage}</div>
      </div>
    );
  }

  return (
    <div ref={submenuRef} className={classNames} style={style}>
      {items.map((item, index) => {
        // Handle separator items (either explicit flag or legacy '-' label)
        if (item.separator || item.label === '-') {
          return <div key={index} className="context-menu-separator" role="separator" aria-orientation="horizontal" />;
        }

        return (
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
              {item.shortcut && !item.submenu && (
                <span className="context-menu-item-shortcut">{item.shortcut}</span>
              )}
              {item.submenu && <span className="context-menu-submenu-arrow">{arrow}</span>}
            </button>
            {item.submenu && openSubmenu === index && (
              <Submenu items={item.submenu} onClose={onClose} />
            )}
          </div>
        );
      })}
    </div>
  );
}
