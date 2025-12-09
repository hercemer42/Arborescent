import { useState, useCallback, useRef, useEffect } from 'react';
import { keyEventToNotation } from '../../../utils/hotkeyUtils';

interface UseHotkeyCaptureOptions {
  initialHotkey: string;
  onConfirm: (newHotkey: string) => void;
  onCancel: () => void;
  hasConflict: boolean;
}

export function useHotkeyCapture({
  initialHotkey,
  onConfirm,
  onCancel,
  hasConflict,
}: UseHotkeyCaptureOptions) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [capturedKey, setCapturedKey] = useState<string>(initialHotkey);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Escape cancels
      if (e.key === 'Escape') {
        onCancel();
        return;
      }

      // Enter confirms (if no conflict)
      if (e.key === 'Enter') {
        if (!hasConflict && capturedKey) {
          onConfirm(capturedKey);
        }
        return;
      }

      // Ignore modifier-only keypresses
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return;
      }

      const notation = keyEventToNotation(e.nativeEvent);
      setCapturedKey(notation);
    },
    [capturedKey, hasConflict, onCancel, onConfirm]
  );

  const handleConfirmClick = useCallback(() => {
    if (capturedKey && !hasConflict) {
      onConfirm(capturedKey);
    }
  }, [capturedKey, hasConflict, onConfirm]);

  return {
    inputRef,
    capturedKey,
    handleKeyDown,
    handleConfirmClick,
  };
}
