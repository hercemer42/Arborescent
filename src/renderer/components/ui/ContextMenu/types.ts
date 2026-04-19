/**
 * Type-only module for the ContextMenu subsystem. Exists specifically to
 * break the cycle that otherwise forms when Submenu.tsx and the
 * behavior hooks need ContextMenuItem from ContextMenu.tsx — and
 * ContextMenu.tsx imports the Submenu component from its neighbor.
 * Both sides now import from this leaf module.
 */
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
