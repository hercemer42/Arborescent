import { forwardRef } from 'react';

interface ShortcutContextMenuProps {
  position: { x: number; y: number };
  isDefault: boolean;
  onRemove: () => void;
  onReset: () => void;
}

export const ShortcutContextMenu = forwardRef<HTMLDivElement, ShortcutContextMenuProps>(
  ({ position, isDefault, onRemove, onReset }, ref) => {
    return (
      <div
        ref={ref}
        className="shortcut-context-menu"
        style={{ left: position.x, top: position.y }}
      >
        <button onClick={onRemove}>Remove Hotkey</button>
        <button onClick={onReset} disabled={isDefault}>
          Reset to Default
        </button>
      </div>
    );
  }
);

ShortcutContextMenu.displayName = 'ShortcutContextMenu';
