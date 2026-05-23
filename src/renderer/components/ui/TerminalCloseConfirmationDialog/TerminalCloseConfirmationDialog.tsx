import { useEffect, useRef } from 'react';
import { Modal } from '../Modal';
import './TerminalCloseConfirmationDialog.css';

interface TerminalCloseConfirmationDialogProps {
  terminalTitle: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TerminalCloseConfirmationDialog({
  terminalTitle,
  onConfirm,
  onCancel,
}: TerminalCloseConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  return (
    <Modal title="Close terminal with active prompt?" width={420} onClose={onCancel}>
      <div className="terminal-close-confirmation-body">
        <p>A prompt is currently processing in:</p>
        <p className="terminal-close-confirmation-terminal">{terminalTitle}</p>
        <p>Closing now will abandon the in-flight response.</p>
        <div className="terminal-close-confirmation-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="terminal-close-confirmation-cancel"
            onClick={onCancel}
          >
            Keep open
          </button>
          <button
            type="button"
            className="terminal-close-confirmation-confirm"
            onClick={onConfirm}
          >
            Close anyway
          </button>
        </div>
      </div>
    </Modal>
  );
}
