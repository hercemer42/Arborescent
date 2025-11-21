import type { TreeStore } from '../store/tree/treeStore';

/**
 * Registry mapping DOM containers to their tree stores.
 * Used by keyboard services and other features that need to find
 * the store for a given DOM element.
 */

const storeRegistry = new Map<HTMLElement, TreeStore>();

/**
 * Registers a tree container with its store.
 * Call this when a tree container mounts.
 */
export function registerTreeContainer(container: HTMLElement, store: TreeStore): void {
  storeRegistry.set(container, store);
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
 * Gets the store for the currently focused element.
 */
export function getStoreForFocusedElement(): TreeStore | null {
  const focused = document.activeElement as HTMLElement | null;
  return getStoreForElement(focused);
}
