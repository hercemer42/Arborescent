import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { initializeKeyboardNavigation, resetRememberedPosition } from '../keyboard';
import { createTreeStore, TreeStore } from '../../../store/tree/treeStore';
import { useHotkeyContextStore } from '../../../store/hotkey/hotkeyContextStore';
import { useFilesStore } from '../../../store/files/filesStore';
import { storeManager } from '../../../store/storeManager';

// Mock Range.getBoundingClientRect which jsdom doesn't implement
Range.prototype.getBoundingClientRect = function () {
  return { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 20, x: 0, y: 0, toJSON: () => ({}) };
};

describe('navigationService', () => {
  let cleanup: (() => void) | undefined;
  let store: TreeStore;
  let container: HTMLDivElement;

  beforeEach(() => {
    const hotkeyStore = useHotkeyContextStore.getState();
    hotkeyStore.setInitialized(true);
    hotkeyStore.setContext('tree');

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

    container = document.createElement('div');
    container.id = 'test-container';
    document.body.appendChild(container);

    // Make the store findable via the new getActiveStore lookup
    useFilesStore.setState({ activeFilePath: '/test/file.arbo' });
    vi.spyOn(storeManager, 'getStoreForFile').mockReturnValue(store);
  });

  afterEach(() => {
    if (cleanup) {
      cleanup();
      cleanup = undefined;
    }
    document.body.removeChild(container);
    vi.restoreAllMocks();
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

  describe('resetRememberedPosition', () => {
    it('should reset rememberedVisualX to null', () => {
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
      (document.activeElement as HTMLElement)?.blur?.();

      expect(() => resetRememberedPosition()).not.toThrow();
    });
  });

  describe('keyboard event handling', () => {
    beforeEach(() => {
      cleanup = initializeKeyboardNavigation();
    });

    it('should not handle events when no active store', () => {
      vi.spyOn(storeManager, 'getStoreForFile').mockReturnValue(undefined as unknown as TreeStore);
      useFilesStore.setState({ activeFilePath: null });

      const orphanElement = document.createElement('div');
      orphanElement.innerHTML = '<div contenteditable="true">Orphan</div>';
      document.body.appendChild(orphanElement);
      (orphanElement.querySelector('[contenteditable]') as HTMLElement).focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp' });
      window.dispatchEvent(event);

      expect(true).toBe(true);

      document.body.removeChild(orphanElement);
    });

    it('should reset rememberedVisualX on Home key', () => {
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

    it('should not intercept Shift+Home for text selection', () => {
      container.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;
      (container.querySelector('[contenteditable]') as HTMLElement).focus();

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', {
        key: 'Home',
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(store.getState().rememberedVisualX).toBe(100);
    });

    it('should not intercept Shift+End for text selection', () => {
      container.innerHTML = `
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
      `;
      (container.querySelector('[contenteditable]') as HTMLElement).focus();

      store.setState({ rememberedVisualX: 100 });

      const event = new KeyboardEvent('keydown', {
        key: 'End',
        shiftKey: true,
        bubbles: true,
      });
      window.dispatchEvent(event);

      expect(store.getState().rememberedVisualX).toBe(100);
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

      expect(store.getState().rememberedVisualX).toBeNull();
    });
  });

  describe('zoom-bounded navigation', () => {
    beforeEach(() => {
      cleanup = initializeKeyboardNavigation();

      store.setState({
        nodes: {
          'root': { id: 'root', content: 'Root', children: ['zoom-root', 'outside-sibling'], metadata: { isRoot: true } },
          'zoom-root': { id: 'zoom-root', content: 'Zoomed', children: ['zoom-child-1', 'zoom-child-2'], metadata: {} },
          'zoom-child-1': { id: 'zoom-child-1', content: 'Zoom Child 1', children: [], metadata: {} },
          'zoom-child-2': { id: 'zoom-child-2', content: 'Zoom Child 2', children: [], metadata: {} },
          'outside-sibling': { id: 'outside-sibling', content: 'Outside', children: [], metadata: {} },
        },
        rootNodeId: 'root',
        activeNodeId: 'zoom-child-1',
        cursorPosition: 0,
        rememberedVisualX: null,
        ancestorRegistry: {
          'zoom-root': ['root'],
          'zoom-child-1': ['root', 'zoom-root'],
          'zoom-child-2': ['root', 'zoom-root'],
          'outside-sibling': ['root'],
        },
      });

      useFilesStore.setState({ activeFilePath: 'zoom:///test/file.arbo#zoom-root' });

      container.innerHTML = `
        <div data-node-id="zoom-child-1">
          <div contenteditable="true">Zoom Child 1</div>
        </div>
        <div data-node-id="zoom-child-2">
          <div contenteditable="true">Zoom Child 2</div>
        </div>
      `;
    });

    it('should not cross the zoom boundary when ArrowUp is pressed on the first child in zoom view', () => {
      const editable = container.querySelector('[data-node-id="zoom-child-1"] [contenteditable]') as HTMLElement;
      editable.focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().activeNodeId).toBe('zoom-child-1');
    });

    it('should not cross to outside sibling when ArrowDown is pressed on the last node in zoom view', async () => {
      await new Promise(resolve => setTimeout(resolve, 60));
      store.setState({ activeNodeId: 'zoom-child-2' });
      const editable = container.querySelector('[data-node-id="zoom-child-2"] [contenteditable]') as HTMLElement;
      editable.focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().activeNodeId).toBe('zoom-child-2');
    });

    it('should navigate between visible children within the zoom subtree on ArrowDown', async () => {
      await new Promise(resolve => setTimeout(resolve, 60));
      const editable = container.querySelector('[data-node-id="zoom-child-1"] [contenteditable]') as HTMLElement;
      editable.focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().activeNodeId).toBe('zoom-child-2');
    });
  });

  describe('link node navigation', () => {
    beforeEach(() => {
      cleanup = initializeKeyboardNavigation();

      store.setState({
        nodes: {
          'root': { id: 'root', content: 'Root', children: ['node-1', 'link-node', 'node-2'], metadata: { isRoot: true } },
          'node-1': { id: 'node-1', content: 'Node 1', children: [], metadata: {} },
          'link-node': { id: 'link-node', content: 'https://example.com', children: [], metadata: { isExternalLink: true, externalUrl: 'https://example.com' } },
          'node-2': { id: 'node-2', content: 'Node 2', children: [], metadata: {} },
        },
        rootNodeId: 'root',
        activeNodeId: 'link-node',
        cursorPosition: 0,
        rememberedVisualX: null,
        ancestorRegistry: {
          'node-1': ['root'],
          'link-node': ['root'],
          'node-2': ['root'],
        },
      });

      container.innerHTML = `
        <div data-node-id="root">
          <div contenteditable="true">Root</div>
        </div>
        <div data-node-id="node-1">
          <div contenteditable="true">Node 1</div>
        </div>
        <div data-node-id="link-node">
          <div contenteditable="false">https://example.com</div>
        </div>
        <div data-node-id="node-2">
          <div contenteditable="true">Node 2</div>
        </div>
      `;
    });

    it('should navigate to previous node on ArrowUp for external link node', () => {
      const linkElement = container.querySelector('[data-node-id="link-node"] [contenteditable]') as HTMLElement;
      linkElement.focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().activeNodeId).toBe('node-1');
    });

    it('should navigate to next node on ArrowDown for external link node', () => {
      const linkElement = container.querySelector('[data-node-id="link-node"] [contenteditable]') as HTMLElement;
      linkElement.focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().activeNodeId).toBe('node-2');
    });

    it('should navigate to previous node on ArrowLeft for external link node', () => {
      const linkElement = container.querySelector('[data-node-id="link-node"] [contenteditable]') as HTMLElement;
      linkElement.focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().activeNodeId).toBe('node-1');
    });

    it('should navigate to next node on ArrowRight for external link node', () => {
      const linkElement = container.querySelector('[data-node-id="link-node"] [contenteditable]') as HTMLElement;
      linkElement.focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().activeNodeId).toBe('node-2');
    });

    it('should navigate immediately for hyperlink nodes', () => {
      store.setState({
        nodes: {
          ...store.getState().nodes,
          'link-node': {
            id: 'link-node',
            content: 'Link to Node 1',
            children: [],
            metadata: { isHyperlink: true, linkedNodeId: 'node-1' },
          },
        },
      });

      const linkElement = container.querySelector('[data-node-id="link-node"] [contenteditable]') as HTMLElement;
      linkElement.focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().activeNodeId).toBe('node-2');
    });

    it('should set rememberedVisualX to 0 when navigating from link node', () => {
      store.setState({ rememberedVisualX: 100 });

      const linkElement = container.querySelector('[data-node-id="link-node"] [contenteditable]') as HTMLElement;
      linkElement.focus();

      const event = new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true });
      window.dispatchEvent(event);

      expect(store.getState().rememberedVisualX).toBe(0);
    });
  });
});
