import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useToastStore } from '../toastStore';

describe('toast system with action buttons', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  describe('addToast with actions', () => {
    it('should create a toast with action buttons', () => {
      const onContinue = vi.fn();
      const onStop = vi.fn();

      useToastStore.getState().addToast(
        'Step 2 complete. Continue to Step 3?',
        'info',
        {
          actions: [
            { label: 'Continue', onClick: onContinue },
            { label: 'Stop', onClick: onStop },
          ],
        }
      );

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].actions).toHaveLength(2);
      expect(toasts[0].actions![0].label).toBe('Continue');
      expect(toasts[0].actions![1].label).toBe('Stop');
    });

    it('should create a toast without actions (backwards compatible)', () => {
      useToastStore.getState().addToast('Simple toast', 'info');

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('Simple toast');
      // actions should be undefined or empty
    });

    it('should preserve action callbacks for later invocation', () => {
      const onContinue = vi.fn();

      useToastStore.getState().addToast(
        'Checkpoint',
        'info',
        { actions: [{ label: 'Continue', onClick: onContinue }] }
      );

      const toasts = useToastStore.getState().toasts;
      toasts[0].actions![0].onClick();

      expect(onContinue).toHaveBeenCalledTimes(1);
    });
  });

  describe('checkpoint confirmation toast', () => {
    it('should create a checkpoint toast with Continue and Stop actions', () => {
      const onContinue = vi.fn();
      const onStop = vi.fn();

      useToastStore.getState().addToast(
        'Step 2 complete. Continue to Step 3?',
        'info',
        {
          actions: [
            { label: 'Continue', onClick: onContinue },
            { label: 'Stop', onClick: onStop },
          ],
          persistent: true, // Does not auto-dismiss
        }
      );

      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].persistent).toBe(true);
    });
  });

  describe('timeout dialog toast', () => {
    it('should create a timeout toast with Dismiss and Pause actions', () => {
      const onDismiss = vi.fn();
      const onPause = vi.fn();

      useToastStore.getState().addToast(
        'Step 1 is taking longer than expected. Verify your AI tool is running.',
        'warning',
        {
          actions: [
            { label: 'Dismiss', onClick: onDismiss },
            { label: 'Pause', onClick: onPause },
          ],
          persistent: true,
        }
      );

      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].type).toBe('warning');
      expect(toasts[0].persistent).toBe(true);
      expect(toasts[0].actions).toHaveLength(2);
    });
  });

  describe('toast removal with actions', () => {
    it('should remove a toast with actions via removeToast', () => {
      const onClick = vi.fn();

      useToastStore.getState().addToast(
        'Test',
        'info',
        { actions: [{ label: 'OK', onClick }] }
      );

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);

      useToastStore.getState().removeToast(toasts[0].id);

      expect(useToastStore.getState().toasts).toHaveLength(0);
    });
  });
});
