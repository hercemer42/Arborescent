import { useEffect, useRef } from 'react';
import type { ToastAction } from './ToastContainer';
import './Toast.css';

export type ToastType = 'error' | 'warning' | 'success' | 'info';

export interface ToastProps {
  message: string;
  type: ToastType;
  duration?: number;
  actions?: ToastAction[];
  persistent?: boolean;
  onClose: () => void;
}

function shouldAutoDismiss(actions?: ToastAction[], persistent?: boolean): boolean {
  if (persistent) return false;
  if (actions && actions.length > 0) return false;
  return true;
}

export function Toast({ message, type, duration = 5000, actions, persistent, onClose }: ToastProps) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!shouldAutoDismiss(actions, persistent)) return;

    const timer = setTimeout(() => {
      onCloseRef.current();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, actions, persistent]);

  function handleActionClick(action: ToastAction): void {
    action.onClick();
    onClose();
  }

  return (
    <div className={`toast toast-${type}`} role="alert">
      <div className="toast-content">
        <span className="toast-icon">{getIcon(type)}</span>
        <span className="toast-message">{message}</span>
      </div>
      {actions && actions.length > 0 && (
        <div className="toast-actions">
          {actions.map((action) => (
            <button
              key={action.label}
              className="toast-action-button"
              onClick={() => handleActionClick(action)}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
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
