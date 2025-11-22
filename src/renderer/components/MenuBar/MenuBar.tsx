import { ReactNode } from 'react';
import { useMenuBarStore } from './store';
import './MenuBar.css';

interface MenuBarProps {
  children: ReactNode;
}

export function MenuBar({ children }: MenuBarProps) {
  const openMenuId = useMenuBarStore((state) => state.openMenuId);
  const closeMenu = useMenuBarStore((state) => state.closeMenu);

  return (
    <>
      {openMenuId !== null && (
        <div className="menu-bar-overlay" onClick={closeMenu} />
      )}
      <div className="menu-bar" role="menubar">
        {children}
      </div>
    </>
  );
}
