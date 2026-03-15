import { ReactNode, useRef } from 'react';
import { useDialogBehavior } from '../../../hooks';
import './Modal.css';

interface ModalProps {
  title: string;
  width?: number;
  onClose: () => void;
  children: ReactNode;
}

export function Modal({ title, width, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useDialogBehavior(dialogRef, onClose);

  return (
    <div className="modal-overlay">
      <div
        ref={dialogRef}
        className="modal-dialog"
        role="dialog"
        style={width ? { width } : undefined}
      >
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        {children}
      </div>
    </div>
  );
}
