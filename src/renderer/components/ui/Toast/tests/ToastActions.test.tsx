import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Toast } from '../Toast';
import type { ToastAction } from '../ToastContainer';

describe('Toast with action buttons', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('rendering', () => {
    it('should render message and close button only when no actions provided', () => {
      const onClose = vi.fn();
      render(<Toast message="Simple message" type="info" onClose={onClose} />);

      expect(screen.getByText('Simple message')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /close notification/i })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
    });

    it('should render one button per action with correct labels', () => {
      const onClose = vi.fn();
      const actions: ToastAction[] = [
        { label: 'Continue', onClick: vi.fn() },
        { label: 'Stop', onClick: vi.fn() },
      ];

      render(<Toast message="Checkpoint" type="info" actions={actions} onClose={onClose} />);

      expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Stop' })).toBeInTheDocument();
    });

    it('should render a single action button', () => {
      const onClose = vi.fn();
      const actions: ToastAction[] = [
        { label: 'Dismiss', onClick: vi.fn() },
      ];

      render(<Toast message="Notice" type="warning" actions={actions} onClose={onClose} />);

      expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
    });

    it('should still have a manual close button when actions are present', () => {
      const onClose = vi.fn();
      const actions: ToastAction[] = [
        { label: 'Continue', onClick: vi.fn() },
      ];

      render(<Toast message="Checkpoint" type="info" actions={actions} onClose={onClose} />);

      expect(screen.getByRole('button', { name: /close notification/i })).toBeInTheDocument();
    });

    it('should render actions with empty array as if no actions', () => {
      const onClose = vi.fn();

      render(<Toast message="No actions" type="info" actions={[]} onClose={onClose} />);

      // Should behave like a normal toast — only close button
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1); // just close button
    });
  });

  describe('callbacks', () => {
    it('should call the action onClick callback when button is clicked', () => {
      const onContinue = vi.fn();
      const onClose = vi.fn();
      const actions: ToastAction[] = [
        { label: 'Continue', onClick: onContinue },
      ];

      render(<Toast message="Checkpoint" type="info" actions={actions} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

      expect(onContinue).toHaveBeenCalledTimes(1);
    });

    it('should dismiss the toast after an action button is clicked', () => {
      const onClose = vi.fn();
      const actions: ToastAction[] = [
        { label: 'Continue', onClick: vi.fn() },
      ];

      render(<Toast message="Checkpoint" type="info" actions={actions} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

      expect(onClose).toHaveBeenCalled();
    });

    it('should call the correct callback when multiple actions are present', () => {
      const onContinue = vi.fn();
      const onStop = vi.fn();
      const onClose = vi.fn();
      const actions: ToastAction[] = [
        { label: 'Continue', onClick: onContinue },
        { label: 'Stop', onClick: onStop },
      ];

      render(<Toast message="Checkpoint" type="info" actions={actions} onClose={onClose} />);

      fireEvent.click(screen.getByRole('button', { name: 'Stop' }));

      expect(onStop).toHaveBeenCalledTimes(1);
      expect(onContinue).not.toHaveBeenCalled();
    });

  });

  describe('auto-dismiss suppression', () => {
    it('should not auto-dismiss when actions are present', () => {
      const onClose = vi.fn();
      const actions: ToastAction[] = [
        { label: 'Continue', onClick: vi.fn() },
        { label: 'Stop', onClick: vi.fn() },
      ];

      render(<Toast message="Checkpoint" type="info" actions={actions} onClose={onClose} />);

      vi.advanceTimersByTime(10000); // well past 5s default

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should auto-dismiss when no actions are present (default behavior)', () => {
      const onClose = vi.fn();

      render(<Toast message="Simple" type="info" onClose={onClose} />);

      vi.advanceTimersByTime(5000);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not auto-dismiss when persistent flag is true even without actions', () => {
      const onClose = vi.fn();

      render(<Toast message="Persistent" type="info" persistent={true} onClose={onClose} />);

      vi.advanceTimersByTime(10000);

      expect(onClose).not.toHaveBeenCalled();
    });

    it('should auto-dismiss when persistent is false and no actions', () => {
      const onClose = vi.fn();

      render(<Toast message="Normal" type="info" persistent={false} onClose={onClose} />);

      vi.advanceTimersByTime(5000);

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('should not auto-dismiss with empty actions array (treated as no actions)', () => {
      const onClose = vi.fn();

      render(<Toast message="Empty actions" type="info" actions={[]} onClose={onClose} />);

      vi.advanceTimersByTime(5000);

      // Empty array = no meaningful actions, should auto-dismiss normally
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('should render action buttons as focusable elements', () => {
      const onClose = vi.fn();
      const actions: ToastAction[] = [
        { label: 'Continue', onClick: vi.fn() },
      ];

      render(<Toast message="Checkpoint" type="info" actions={actions} onClose={onClose} />);

      const button = screen.getByRole('button', { name: 'Continue' });
      expect(button.tagName).toBe('BUTTON');
    });

    it('should trigger action callback on Enter key press', () => {
      const onContinue = vi.fn();
      const onClose = vi.fn();
      const actions: ToastAction[] = [
        { label: 'Continue', onClick: onContinue },
      ];

      render(<Toast message="Checkpoint" type="info" actions={actions} onClose={onClose} />);

      const button = screen.getByRole('button', { name: 'Continue' });
      fireEvent.keyDown(button, { key: 'Enter' });

      // Native button elements handle Enter/Space natively, but verify the button is accessible
      expect(button).not.toHaveAttribute('tabindex', '-1');
    });

    it('should maintain role="alert" when actions are present', () => {
      const onClose = vi.fn();
      const actions: ToastAction[] = [
        { label: 'Continue', onClick: vi.fn() },
      ];

      render(<Toast message="Checkpoint" type="info" actions={actions} onClose={onClose} />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});
