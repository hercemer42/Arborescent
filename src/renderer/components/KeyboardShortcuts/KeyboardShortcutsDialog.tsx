import { X, RotateCcw } from 'lucide-react';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { ShortcutRow } from './ShortcutRow';
import { HotkeyEditDialog } from './HotkeyEditDialog';
import { getActionLabel, getCategoryLabel } from './hotkeyLabels';
import './KeyboardShortcutsDialog.css';

interface KeyboardShortcutsDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcutsDialog({ isOpen, onClose }: KeyboardShortcutsDialogProps) {
  const {
    hotkeys,
    editingAction,
    handleEdit,
    handleEditCancel,
    handleEditConfirm,
    handleRestoreDefaults,
    handleRemoveHotkey,
    handleResetHotkey,
    getConflict,
    isDefault,
  } = useKeyboardShortcuts();

  if (!isOpen) return null;

  const categories = Object.keys(hotkeys) as Array<keyof typeof hotkeys>;

  return (
    <div className="keyboard-shortcuts-overlay" onClick={onClose}>
      <div className="keyboard-shortcuts-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="keyboard-shortcuts-header">
          <h2>Keyboard Shortcuts</h2>
          <button className="keyboard-shortcuts-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="keyboard-shortcuts-content">
          {categories.map((category) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const categoryHotkeys = (hotkeys as any)[category] as Record<string, string>;
            return (
              <div key={category} className="keyboard-shortcuts-category">
                <h3>{getCategoryLabel(category)}</h3>
                <div className="keyboard-shortcuts-list">
                  {Object.entries(categoryHotkeys).map(([action, key]) => (
                    <ShortcutRow
                      key={action}
                      label={getActionLabel(action)}
                      hotkey={key}
                      isDefault={isDefault(category, action)}
                      onEdit={() => handleEdit(category, action)}
                      onRemove={() => handleRemoveHotkey(category, action)}
                      onReset={() => handleResetHotkey(category, action)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="keyboard-shortcuts-footer">
          <button className="keyboard-shortcuts-restore" onClick={handleRestoreDefaults}>
            <RotateCcw size={16} />
            Restore Defaults
          </button>
        </div>

        {editingAction && (
          <HotkeyEditDialog
            actionLabel={getActionLabel(editingAction.action)}
            currentHotkey={
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              ((hotkeys as any)[editingAction.category] as Record<string, string>)?.[editingAction.action] ?? ''
            }
            conflict={getConflict()}
            onConfirm={handleEditConfirm}
            onCancel={handleEditCancel}
          />
        )}
      </div>
    </div>
  );
}
