import { describe, it, expect, beforeEach } from 'vitest';
import { useToastStore } from '../toastStore';

describe('toastStore', () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  describe('addToast', () => {
    it('should add a toast with unique id', () => {
      const { addToast } = useToastStore.getState();

      addToast('Test message', 'info');

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(1);
      expect(toasts[0].message).toBe('Test message');
      expect(toasts[0].type).toBe('info');
      expect(toasts[0].id).toBeDefined();
    });

    it('should add multiple toasts', () => {
      const { addToast } = useToastStore.getState();

      addToast('First', 'success');
      addToast('Second', 'error');

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(2);
      expect(toasts[0].message).toBe('First');
      expect(toasts[1].message).toBe('Second');
    });

    it('should generate unique ids for each toast', () => {
      const { addToast } = useToastStore.getState();

      addToast('First', 'info');
      addToast('Second', 'info');

      const toasts = useToastStore.getState().toasts;
      expect(toasts[0].id).not.toBe(toasts[1].id);
    });

    it('should support all toast types', () => {
      const { addToast } = useToastStore.getState();

      addToast('Error', 'error');
      addToast('Warning', 'warning');
      addToast('Success', 'success');
      addToast('Info', 'info');

      const toasts = useToastStore.getState().toasts;
      expect(toasts).toHaveLength(4);
      expect(toasts[0].type).toBe('error');
      expect(toasts[1].type).toBe('warning');
      expect(toasts[2].type).toBe('success');
      expect(toasts[3].type).toBe('info');
    });
  });

  describe('removeToast', () => {
    it('should remove toast by id', () => {
      const { addToast, removeToast } = useToastStore.getState();

      addToast('Test', 'info');
      const toastId = useToastStore.getState().toasts[0].id;

      removeToast(toastId);

      expect(useToastStore.getState().toasts).toHaveLength(0);
    });

    it('should remove only the specified toast', () => {
      const { addToast, removeToast } = useToastStore.getState();

      addToast('First', 'info');
      addToast('Second', 'info');
      addToast('Third', 'info');

      const toasts = useToastStore.getState().toasts;
      const secondId = toasts[1].id;

      removeToast(secondId);

      const remainingToasts = useToastStore.getState().toasts;
      expect(remainingToasts).toHaveLength(2);
      expect(remainingToasts[0].message).toBe('First');
      expect(remainingToasts[1].message).toBe('Third');
    });

    it('should handle removing non-existent toast gracefully', () => {
      const { addToast, removeToast } = useToastStore.getState();

      addToast('Test', 'info');

      removeToast('non-existent-id');

      expect(useToastStore.getState().toasts).toHaveLength(1);
    });
  });
});
