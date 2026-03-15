import { describe, it, expect, beforeEach } from 'vitest';
import { useStepConfigDialogStore } from '../stepConfigDialogStore';

describe('stepConfigDialogStore', () => {
  beforeEach(() => {
    useStepConfigDialogStore.setState({
      isOpen: false,
      nodeId: null,
    });
  });

  describe('initial state', () => {
    it('should start closed with no nodeId', () => {
      const state = useStepConfigDialogStore.getState();

      expect(state.isOpen).toBe(false);
      expect(state.nodeId).toBeNull();
    });
  });

  describe('open', () => {
    it('should set isOpen to true and store nodeId', () => {
      useStepConfigDialogStore.getState().open('node-1');

      const state = useStepConfigDialogStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.nodeId).toBe('node-1');
    });

    it('should replace current state when called while already open', () => {
      useStepConfigDialogStore.getState().open('node-1');
      useStepConfigDialogStore.getState().open('node-2');

      const state = useStepConfigDialogStore.getState();
      expect(state.isOpen).toBe(true);
      expect(state.nodeId).toBe('node-2');
    });
  });

  describe('close', () => {
    it('should set isOpen to false and clear nodeId', () => {
      useStepConfigDialogStore.getState().open('node-1');
      useStepConfigDialogStore.getState().close();

      const state = useStepConfigDialogStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.nodeId).toBeNull();
    });

    it('should be safe to call when already closed', () => {
      useStepConfigDialogStore.getState().close();

      const state = useStepConfigDialogStore.getState();
      expect(state.isOpen).toBe(false);
      expect(state.nodeId).toBeNull();
    });
  });
});
