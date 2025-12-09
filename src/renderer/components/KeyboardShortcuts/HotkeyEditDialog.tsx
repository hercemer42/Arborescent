import { formatHotkeyForDisplay } from '../../utils/hotkeyUtils';
import { useHotkeyCapture } from './hooks/useHotkeyCapture';

interface HotkeyEditDialogProps {
  actionLabel: string;
  currentHotkey: string;
  conflict: { category: string; action: string; label: string } | null;
  onConfirm: (newHotkey: string) => void;
  onCancel: () => void;
}

export function HotkeyEditDialog({
  actionLabel,
  currentHotkey,
  conflict,
  onConfirm,
  onCancel,
}: HotkeyEditDialogProps) {
  const hasConflict = conflict !== null;

  const { inputRef, capturedKey, handleKeyDown, handleConfirmClick } = useHotkeyCapture({
    initialHotkey: currentHotkey,
    onConfirm,
    onCancel,
    hasConflict,
  });

  const displayKey = capturedKey ? formatHotkeyForDisplay(capturedKey) : '';

  return (
    <div className="hotkey-edit-overlay" onClick={onCancel}>
      <div className="hotkey-edit-dialog" onClick={(e) => e.stopPropagation()}>
        <h3>Set shortcut for "{actionLabel}"</h3>
        <p>Press desired key combination, then press ENTER</p>

        <input
          ref={inputRef}
          type="text"
          className={`hotkey-edit-input ${hasConflict ? 'conflict' : ''}`}
          value={displayKey}
          readOnly
          onKeyDown={handleKeyDown}
          placeholder="Press keys..."
        />

        {hasConflict && (
          <p className="hotkey-edit-conflict">
            Already in use by "{conflict.label}" — pick another
          </p>
        )}

        <div className="hotkey-edit-actions">
          <button className="hotkey-edit-cancel" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="hotkey-edit-confirm"
            onClick={handleConfirmClick}
            disabled={hasConflict || !capturedKey}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
