import { useEffect, useRef } from 'react';
import { Modal } from '../Modal';
import './RebindConfirmationDialog.css';

interface RebindConfirmationDialogProps {
  previousNodeLabel: string;
  newNodeLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RebindConfirmationDialog({
  previousNodeLabel,
  newNodeLabel,
  onConfirm,
  onCancel,
}: RebindConfirmationDialogProps) {
  const confirmButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    confirmButtonRef.current?.focus();
  }, []);

  return (
    <Modal title="Rebind Claude Code session?" width={420} onClose={onCancel}>
      <div className="rebind-confirmation-body">
        <p>This Claude Code session is currently bound to:</p>
        <p className="rebind-confirmation-node rebind-confirmation-node-previous">
          {previousNodeLabel}
        </p>
        <p>You are about to rebind it to:</p>
        <p className="rebind-confirmation-node rebind-confirmation-node-new">
          {newNodeLabel}
        </p>
        <div className="rebind-confirmation-actions">
          <button type="button" className="rebind-confirmation-cancel" onClick={onCancel}>
            Keep current
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className="rebind-confirmation-confirm"
            onClick={onConfirm}
          >
            Rebind
          </button>
        </div>
      </div>
    </Modal>
  );
}
