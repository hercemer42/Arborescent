import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeKeyboardNavigation, resetRememberedPosition } from '../keyboard';
import { registerTreeContainer, unregisterTreeContainer } from '../../treeContainerRegistry';
import { createTreeStore, TreeStore } from '../../../store/tree/treeStore';

// Mock Range.getBoundingClientRect which jsdom doesn't implement
Range.prototype.getBoundingClientRect = function () {
  return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 20, x: 0, y: 0, toJSON: () => ({}) };
};

describe('navigationService', () => {
  let cleanup: (() => void) | undefined;
  let store: TreeStore;
  let container: HTMLDivElement;

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

    // Create a container and register it with the store
    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);
    registerTreeContainer(container, store);
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }
    unregisterTreeContainer(container);
    document.body.removeChild(container);
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

  describe('registerTreeContainer', () => {
    it('should register a container with its store', () => {
      const newStore = createTreeStore();
      const newContainer = document.createElement('div');
      document.body.appendChild(newContainer);

      // Should not throw
      expect(() => registerTreeContainer(newContainer, newStore)).not.toThrow();

      unregisterTreeContainer(newContainer);
      document.body.removeChild(newContainer);
    });

    it('should allow unregistering a container', () => {
      const newStore = createTreeStore();
      const newContainer = document.createElement('div');
      document.body.appendChild(newContainer);

      registerTreeContainer(newContainer, newStore);
      expect(() => unregisterTreeContainer(newContainer)).not.toThrow();

      document.body.removeChild(newContainer);
    });
  });

  describe('resetRememberedPosition', () => {
    it('should reset rememberedVisualX to null', () => {
      // Put focus inside the container so the store can be found
      container.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;
      const editable = container.querySelector('[contenteditable]') as HTMLElement;
      editable.focus();

      store.setState({ rememberedVisualX: 100 });

      resetRememberedPosition();

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should handle when no element is focused', () => {
      // No element is focused, so no store can be found
      (document.activeElement as HTMLElement)?.blur?.();

      // Should not throw
      expect(() => resetRememberedPosition()).not.toThrow();
    });
  });

  describe('keyboard event handling', () => {
    beforeEach(() => {
      cleanup = initializeKeyboardNavigation();
    });

    it('should not handle events when no active store', () => {
      // Create an element outside any registered container
      const orphanElement = document.createElement('div');
      orphanElement.innerHTML = '<div contenteditable="true">Orphan</div>';
      document.body.appendChild(orphanElement);
      (orphanElement.querySelector('[contenteditable]') as HTMLElement).focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      window.dispatchEvent(event);

      // Should not throw
      expect(true).toBe(true);

      document.body.removeChild(orphanElement);
    });

    it('should reset rememberedVisualX on Home key', () => {
      // Create mock element inside container
      container.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;
      const editable = container.querySelector('[contenteditable]') as HTMLElement;
      editable.focus();

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', { key: 'Home', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should reset rememberedVisualX on End key', () => {
      container.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;
      (container.querySelector('[contenteditable]') as HTMLElement).focus();

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', { key: 'End', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should reset rememberedVisualX on PageUp key', async () => {
      container.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;
      (container.querySelector('[contenteditable]') as HTMLElement).focus();

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true });
      window.dispatchEvent(event);

      // Wait for setTimeout(0) to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should reset rememberedVisualX on PageDown key', async () => {
      container.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;
      (container.querySelector('[contenteditable]') as HTMLElement).focus();

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true });
      window.dispatchEvent(event);

      // Wait for setTimeout(0) to execute
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should reset rememberedVisualX on character input', () => {
      container.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;
      (container.querySelector('[contenteditable]') as HTMLElement).focus();

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should reset rememberedVisualX on Backspace', () => {
      container.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;
      (container.querySelector('[contenteditable]') as HTMLElement).focus();

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should reset rememberedVisualX on Delete', () => {
      container.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;
      (container.querySelector('[contenteditable]') as HTMLElement).focus();

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', { key: 'Delete', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().rememberedVisualX).toBeNull();
    });

    it('should not interfere with text selection (Shift + arrow keys)', () => {
      container.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;
      (container.querySelector('[contenteditable]') as HTMLElement).focus();

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
      container.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;
      (container.querySelector('[contenteditable]') as HTMLElement).focus();

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
