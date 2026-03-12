import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastContainer } from '../ToastContainer';
import type { ToastItem } from '../ToastContainer';

describe('ToastContainer prop forwarding', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe('actions forwarding', () => {
    it('should pass actions array through to Toast component', () => {
      const onContinue = vi.fn();
      const onStop = vi.fn();
      const toasts: ToastItem[] = [
        {
          id: '1',
          message: 'Checkpoint complete',
          type: 'info',
          actions: [
            { label: 'Continue', onClick: onContinue },
            { label: 'Stop', onClick: onStop },
          ],
        },
      ];

      render(<ToastContainer toasts={toasts} onRemove={vi.fn()} />);

      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    });

    it('should wire action callbacks correctly through container', () => {
      const onContinue = vi.fn();
      const toasts: ToastItem[] = [
        {
          id: '1',
          message: 'Checkpoint complete',
          type: 'info',
          actions: [{ label: 'Continue', onClick: onContinue }],
        },
      ];

      render(<ToastContainer toasts={toasts} onRemove={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
      expect(onContinue).toHaveBeenCalledTimes(1);
    });
  });

  describe('persistent forwarding', () => {
    it('should pass persistent flag through to Toast component', () => {
      const onRemove = vi.fn();
      const toasts: ToastItem[] = [
        {
          id: '1',
          message: 'Persistent toast',
          type: 'info',
          persistent: true,
        },
      ];

      render(<ToastContainer toasts={toasts} onRemove={onRemove} />);

      vi.advanceTimersByTime(10000);

      // Persistent toast should not auto-dismiss
      expect(onRemove).not.toHaveBeenCalled();
    });

    it('should not suppress auto-dismiss when persistent is false', () => {
      const onRemove = vi.fn();
      const toasts: ToastItem[] = [
        {
          id: '1',
          message: 'Normal toast',
          type: 'info',
          persistent: false,
        },
      ];

      render(<ToastContainer toasts={toasts} onRemove={onRemove} />);

      vi.advanceTimersByTime(5000);

      expect(onRemove).toHaveBeenCalledWith('1');
    });
  });

  describe('mixed toasts', () => {
    it('should render toasts with and without actions correctly', () => {
      const toasts: ToastItem[] = [
        { id: '1', message: 'Simple toast', type: 'info' },
        {
          id: '2',
          message: 'Checkpoint toast',
          type: 'info',
          actions: [
            { label: 'Continue', onClick: vi.fn() },
            { label: 'Stop', onClick: vi.fn() },
          ],
          persistent: true,
        },
        { id: '3', message: 'Warning toast', type: 'warning' },
      ];
      const onRemove = vi.fn();

      render(<ToastContainer toasts={toasts} onRemove={onRemove} />);

      // All messages rendered
      expect(screen.getByText('Simple toast')).toBeInTheDocument();
      expect(screen.getByText('Checkpoint toast')).toBeInTheDocument();
      expect(screen.getByText('Warning toast')).toBeInTheDocument();

      // Only the checkpoint toast has action buttons
      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    });

    it('should auto-dismiss non-persistent toasts while persistent ones stay', () => {
      const onRemove = vi.fn();
      const toasts: ToastItem[] = [
        { id: 'auto', message: 'Auto dismiss', type: 'info' },
        {
          id: 'persistent',
          message: 'Stay here',
          type: 'info',
          actions: [{ label: 'OK', onClick: vi.fn() }],
        },
      ];

      render(<ToastContainer toasts={toasts} onRemove={onRemove} />);

      vi.advanceTimersByTime(5000);

      // Only the non-persistent toast should trigger removal
      expect(onRemove).toHaveBeenCalledWith('auto');
      expect(onRemove).not.toHaveBeenCalledWith('persistent');
    });
  });
});
