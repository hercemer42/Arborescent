import { ReactNode } from 'react';
import { useMenu } from './hooks';

interface MenuProps {
  id: string;
  label: string;
  children: ReactNode;
}

export function Menu({ id, label, children }: MenuProps) {
  const {
    isOpen,
    menuRef,
    triggerRef,
    itemsRef,
    handleTriggerClick,
    handleTriggerKeyDown,
    handleMenuKeyDown,
    handleMouseEnter,
  } = useMenu({ id });

  return (
    <div className="menu" ref={menuRef} onMouseEnter={handleMouseEnter}>
      <button
        ref={triggerRef}
        className={`menu-trigger ${isOpen ? 'active' : ''}`}
        onClick={handleTriggerClick}
        onKeyDown={handleTriggerKeyDown}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        {label}
      </button>
      {isOpen && (
        <div
          ref={itemsRef}
          className="menu-dropdown"
          role="menu"
          onKeyDown={handleMenuKeyDown}
        >
          {children}
        </div>
      )}
    </div>
  );
}
