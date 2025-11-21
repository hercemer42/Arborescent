import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ToastContainer } from '../ToastContainer';
import type { ToastItem } from '../ToastContainer';

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should render empty container when no toasts', () => {
    const onRemove = vi.fn();
    const { container } = render(<ToastContainer toasts={[]} onRemove={onRemove} />);

    expect(container.firstChild).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('should render single toast', () => {
    const toasts: ToastItem[] = [
      { id: '1', message: 'Test toast', type: 'info' },
    ];
    const onRemove = vi.fn();

    render(<ToastContainer toasts={toasts} onRemove={onRemove} />);

    expect(screen.getByText('Test toast')).toBeInTheDocument();
  });

  it('should render multiple toasts', () => {
    const toasts: ToastItem[] = [
      { id: '1', message: 'First toast', type: 'info' },
      { id: '2', message: 'Second toast', type: 'error' },
      { id: '3', message: 'Third toast', type: 'success' },
    ];
    const onRemove = vi.fn();

    render(<ToastContainer toasts={toasts} onRemove={onRemove} />);

    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
    expect(screen.getByText('Third toast')).toBeInTheDocument();
  });

  it('should call onRemove with correct id when close button clicked', () => {
    const toasts: ToastItem[] = [
      { id: 'toast-123', message: 'Test', type: 'info' },
    ];
    const onRemove = vi.fn();

    render(<ToastContainer toasts={toasts} onRemove={onRemove} />);

    const closeButton = screen.getByRole('button', { name: /close notification/i });
    fireEvent.click(closeButton);

    expect(onRemove).toHaveBeenCalledWith('toast-123');
  });

  it('should call onRemove when toast duration expires', () => {
    const toasts: ToastItem[] = [
      { id: 'toast-456', message: 'Auto-close', type: 'success' },
    ];
    const onRemove = vi.fn();

    render(<ToastContainer toasts={toasts} onRemove={onRemove} />);

    expect(onRemove).not.toHaveBeenCalled();

    vi.advanceTimersByTime(8000);

    expect(onRemove).toHaveBeenCalledWith('toast-456');
  });

  it('should call onRemove for correct toast when multiple toasts exist', () => {
    const toasts: ToastItem[] = [
      { id: '1', message: 'First', type: 'info' },
      { id: '2', message: 'Second', type: 'error' },
      { id: '3', message: 'Third', type: 'success' },
    ];
    const onRemove = vi.fn();

    render(<ToastContainer toasts={toasts} onRemove={onRemove} />);

    const closeButtons = screen.getAllByRole('button', { name: /close notification/i });
    fireEvent.click(closeButtons[1]); // Click second toast's close button

    expect(onRemove).toHaveBeenCalledWith('2');
  });

  it('should render toasts with correct types', () => {
    const toasts: ToastItem[] = [
      { id: '1', message: 'Error message', type: 'error' },
      { id: '2', message: 'Warning message', type: 'warning' },
      { id: '3', message: 'Success message', type: 'success' },
      { id: '4', message: 'Info message', type: 'info' },
    ];
    const onRemove = vi.fn();

    const { container } = render(<ToastContainer toasts={toasts} onRemove={onRemove} />);

    expect(container.querySelector('.toast-error')).toBeInTheDocument();
    expect(container.querySelector('.toast-warning')).toBeInTheDocument();
    expect(container.querySelector('.toast-success')).toBeInTheDocument();
    expect(container.querySelector('.toast-info')).toBeInTheDocument();
  });
});
