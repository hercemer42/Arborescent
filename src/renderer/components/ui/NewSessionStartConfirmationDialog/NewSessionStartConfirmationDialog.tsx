import { useEffect, useRef } from 'react';
import { Modal } from '../Modal';
import './NewSessionStartConfirmationDialog.css';

interface NewSessionStartConfirmationDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export function NewSessionStartConfirmationDialog({
  onConfirm,
  onCancel,
}: NewSessionStartConfirmationDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    cancelButtonRef.current?.focus();
  }, []);

  return (
    <Modal title="Start in a new session?" width={420} onClose={onCancel}>
      <div className="new-session-start-confirmation-body">
        <p>This node is connected to a session.</p>
        <p>Starting in a new session disconnects it from the current session and spawns a fresh one.</p>
        <div className="new-session-start-confirmation-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="new-session-start-confirmation-cancel"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="new-session-start-confirmation-confirm"
            onClick={onConfirm}
          >
            Start fresh
          </button>
        </div>
      </div>
    </Modal>
  );
}
