import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast } from '../Toast';

describe('Toast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should render message', () => {
    const onClose = vi.fn();
    render(<Toast message="Test message" type="info" onClose={onClose} />);

    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('should render with correct type class', () => {
    const onClose = vi.fn();
    const { container } = render(<Toast message="Test" type="error" onClose={onClose} />);

    const toast = container.querySelector('.toast-error');
    expect(toast).toBeInTheDocument();
  });

  it('should render correct icon for error type', () => {
    const onClose = vi.fn();
    render(<Toast message="Error" type="error" onClose={onClose} />);

    expect(screen.getByText('✕')).toBeInTheDocument();
  });

  it('should render correct icon for warning type', () => {
    const onClose = vi.fn();
    render(<Toast message="Warning" type="warning" onClose={onClose} />);

    expect(screen.getByText('⚠')).toBeInTheDocument();
  });

  it('should render correct icon for success type', () => {
    const onClose = vi.fn();
    render(<Toast message="Success" type="success" onClose={onClose} />);

    expect(screen.getByText('✓')).toBeInTheDocument();
  });

  it('should render correct icon for info type', () => {
    const onClose = vi.fn();
    render(<Toast message="Info" type="info" onClose={onClose} />);

    expect(screen.getByText('ℹ')).toBeInTheDocument();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<Toast message="Test" type="info" onClose={onClose} />);

    const closeButton = screen.getByRole('button', { name: /close notification/i });
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose after default duration', () => {
    const onClose = vi.fn();
    render(<Toast message="Test" type="info" onClose={onClose} />);

    expect(onClose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(8000);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should call onClose after custom duration', () => {
    const onClose = vi.fn();
    render(<Toast message="Test" type="info" duration={3000} onClose={onClose} />);

    vi.advanceTimersByTime(2999);
    expect(onClose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('should clear timer on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(<Toast message="Test" type="info" onClose={onClose} />);

    unmount();
    vi.advanceTimersByTime(5000);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should have role alert for accessibility', () => {
    const onClose = vi.fn();
    render(<Toast message="Test" type="info" onClose={onClose} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});
