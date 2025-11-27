import type { TreeStore } from '../store/tree/treeStore';

/**
 * Registry mapping DOM containers to their tree stores.
 * Used by keyboard services and other features that need to find
 * the store for a given DOM element.
 */

const storeRegistry = new Map<HTMLElement, TreeStore>();

// Track the last active store for when no element is focused
let lastActiveStore: TreeStore | null = null;

/**
 * Registers a tree container with its store.
 * Call this when a tree container mounts.
 */
export function registerTreeContainer(container: HTMLElement, store: TreeStore): void {
  storeRegistry.set(container, store);
  // Set as last active if no other store is active yet
  if (!lastActiveStore) {
    lastActiveStore = store;
  }
}

/**
 * Unregisters a tree container.
 * Call this when a tree container unmounts.
 */
export function unregisterTreeContainer(container: HTMLElement): void {
  storeRegistry.delete(container);
}

/**
 * Gets the store for an element by finding its registered container ancestor.
 */
export function getStoreForElement(element: HTMLElement | null): TreeStore | null {
  if (!element) return null;

  // Walk up the DOM to find a registered container
  let current: HTMLElement | null = element;
  while (current) {
    const store = storeRegistry.get(current);
    if (store) return store;
    current = current.parentElement;
  }
  return null;
}

/**
 * Sets the last active store.
 * Called when a tree container gains focus.
 */
export function setLastActiveStore(store: TreeStore): void {
  lastActiveStore = store;
}

/**
 * Gets the store for the currently focused element.
 * Falls back to the last active store if no focused element is in a container.
 */
export function getStoreForFocusedElement(): TreeStore | null {
  const focused = document.activeElement as HTMLElement | null;
  const store = getStoreForElement(focused);

  if (store) {
    lastActiveStore = store;
    return store;
  }

  // Fall back to last active store (e.g., after blur from multi-selection)
  return lastActiveStore;
}
