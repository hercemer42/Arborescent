import type { TreeStore } from '../store/tree/treeStore';

const storeRegistry = new Map<HTMLElement, TreeStore>();
let lastActiveStore: TreeStore | null = null;

export function registerTreeContainer(container: HTMLElement, store: TreeStore): void {
  storeRegistry.set(container, store);
  if (!lastActiveStore) {
    lastActiveStore = store;
  }
}

export function unregisterTreeContainer(container: HTMLElement): void {
  storeRegistry.delete(container);
}

export function getStoreForElement(element: HTMLElement | null): TreeStore | null {
  if (!element) return null;

  let current: HTMLElement | null = element;
  while (current) {
    const store = storeRegistry.get(current);
    if (store) return store;
    current = current.parentElement;
  }
  return null;
}

export function setLastActiveStore(store: TreeStore): void {
  lastActiveStore = store;
}

export function getStoreForFocusedElement(): TreeStore | null {
  const focused = document.activeElement as HTMLElement | null;
  const store = getStoreForElement(focused);

  if (store) {
    lastActiveStore = store;
    return store;
  }

  return lastActiveStore;
}
