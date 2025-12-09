import { Pencil } from 'lucide-react';
import { formatHotkeyForDisplay } from '../../utils/hotkeyUtils';
import { useShortcutContextMenu } from './hooks/useShortcutContextMenu';
import { ShortcutContextMenu } from './ShortcutContextMenu';

interface ShortcutRowProps {
  label: string;
  hotkey: string;
  isDefault: boolean;
  onEdit: () => void;
  onRemove: () => void;
  onReset: () => void;
}

export function ShortcutRow({
  label,
  hotkey,
  isDefault,
  onEdit,
  onRemove,
  onReset,
}: ShortcutRowProps) {
  const { contextMenu, menuRef, handleContextMenu, handleRemove, handleReset } =
    useShortcutContextMenu({
      onRemove,
      onReset,
    });

  return (
    <>
      <div
        className={`shortcut-row ${!hotkey ? 'no-hotkey' : ''}`}
        onContextMenu={handleContextMenu}
      >
        <span className="shortcut-label">{label}</span>
        <span className="shortcut-key">
          {hotkey ? formatHotkeyForDisplay(hotkey) : '(none)'}
        </span>
        <button
          className="shortcut-edit"
          onClick={onEdit}
          aria-label={`Edit ${label} shortcut`}
        >
          <Pencil size={14} />
        </button>
      </div>
      {contextMenu && (
        <ShortcutContextMenu
          ref={menuRef}
          position={contextMenu}
          isDefault={isDefault}
          onRemove={handleRemove}
          onReset={handleReset}
        />
      )}
    </>
  );
}
