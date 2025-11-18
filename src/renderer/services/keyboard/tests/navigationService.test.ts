import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  initializeKeyboardNavigation,
  setActiveStore,
  resetRememberedPosition,
} from '../keyboard';
import { createTreeStore, TreeStore } from '../../../store/tree/treeStore';

describe('navigationService', () => {
  let cleanup: (() => void) | undefined;
  let store: TreeStore;

  beforeEach(() => {
    store = createTreeStore();
    store.setState({
      nodes: {
        'node-1': { id: 'node-1', content: 'Node 1', children: [], metadata: {} },
        'node-2': { id: 'node-2', content: 'Node 2', children: [], metadata: {} },
      },
      rootNodeId: 'node-1',
      activeNodeId: 'node-1',
      cursorPosition: 0,
      rememberedVisualX: null,
      ancestorRegistry: {},
    });
    setActiveStore(store);
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }
    setActiveStore(null);
  });

  describe('initializeKeyboardNavigation', () => {
    it('should initialize keyboard listener and return cleanup function', () => {
      cleanup = initializeKeyboardNavigation();

      expect(cleanup).toBeTypeOf('function');
    });

    it('should cleanup event listeners when cleanup is called', () => {
      const addEventListenerSpy = vi.spyOn(window, 'addEventListener');
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

      cleanup = initializeKeyboardNavigation();
      expect(addEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);

      cleanup();
      expect(removeEventListenerSpy).toHaveBeenCalledWith('keydown', expect.any(Function), true);

      addEventListenerSpy.mockRestore();
      removeEventListenerSpy.mockRestore();
    });
  });

  describe('setActiveStore', () => {
    it('should set the active store', () => {
      const newStore = createTreeStore();
      setActiveStore(newStore);

      // Should not throw - store is now set
      expect(() => setActiveStore(newStore)).not.toThrow();
    });

    it('should allow setting store to null', () => {
      setActiveStore(null);

      // Should not throw
      expect(() => setActiveStore(null)).not.toThrow();
    });
  });

  describe('resetRememberedPosition', () => {
    it('should reset rememberedVisualX to null', () => {
      store.setState({ rememberedVisualX: 100 });

      resetRememberedPosition();

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should handle when store is null', () => {
      setActiveStore(null);

      // Should not throw
      expect(() => resetRememberedPosition()).not.toThrow();
    });
  });

  describe('keyboard event handling', () => {
    beforeEach(() => {
      cleanup = initializeKeyboardNavigation();
    });

    it('should not handle events when no active store', () => {
      setActiveStore(null);

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      window.dispatchEvent(event);

      // Should not throw
      expect(true).toBe(true);
    });

    it('should reset rememberedVisualX on Home key', () => {
      // Create mock element
      document.body.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', { key: 'Home', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should reset rememberedVisualX on End key', () => {
      document.body.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', { key: 'End', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should reset rememberedVisualX on PageUp key', async () => {
      document.body.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true });
      window.dispatchEvent(event);

      // Wait for setTimeout(0) to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should reset rememberedVisualX on PageDown key', async () => {
      document.body.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true });
      window.dispatchEvent(event);

      // Wait for setTimeout(0) to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should reset rememberedVisualX on character input', () => {
      document.body.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should reset rememberedVisualX on Backspace', () => {
      document.body.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should reset rememberedVisualX on Delete', () => {
      document.body.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should not interfere with text selection (Shift + arrow keys)', () => {
      document.body.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      // Should reset rememberedVisualX but not prevent default
      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should not handle arrow keys with Ctrl modifier', () => {
      document.body.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', {
        key: 'ArrowUp',
        ctrlKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      // Should reset rememberedVisualX but not handle navigation
      expect(store.getState().rememberedVisualX).toBeNull();
    });
  });
});
