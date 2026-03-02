import { useEffect, useRef } from 'react';
import './Toast.css';

export type ToastType = 'error' | 'warning' | 'success' | 'info';

export interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({ message, type, duration = 5000, onClose }: ToastProps) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const timer = setTimeout(() => {
      onCloseRef.current();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration]);

  return (
    <div className={`toast toast-${type}`} role="alert">
      <div className="toast-content">
        <span className="toast-icon">{getIcon(type)}</span>
        <span className="toast-message">{message}</span>
      </div>
      <button
        className="toast-close"
        onClick={onClose}
        aria-label="Close notification"
      >
        ×
      </button>
    </div>
  );
}

function getIcon(type: ToastType): string {
  switch (type) {
    case 'error':
      return '✕';
    case 'warning':
      return '⚠';
    case 'success':
      return '✓';
    case 'info':
      return 'ℹ';
  }
}
