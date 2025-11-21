import type { TreeStore } from '../../store/tree/treeStore';
import { getStoreForFocusedElement } from '../treeContainerRegistry';

/**
 * Shared utilities for keyboard services
 */

/**
 * Gets the active node's contentEditable element for a given store
 */
export function getActiveNodeElementForStore(store: TreeStore): HTMLElement | null {
  const activeNodeId = store.getState().activeNodeId;
  if (!activeNodeId) return null;

  // React renders contentEditable as contenteditable="" (empty string) or "true"
  const element = document.querySelector(
    `[data-node-id="${activeNodeId}"] [contenteditable]`
  ) as HTMLElement | null;

  return element;
}

/**
 * Gets the store for the currently focused element
 */
export function getActiveStore(): TreeStore | null {
  return getStoreForFocusedElement();
}

/**
 * Gets the active node's contentEditable element from the currently focused element's store
 */
export function getActiveNodeElement(): HTMLElement | null {
  const store = getActiveStore();
  if (!store) return null;
  return getActiveNodeElementForStore(store);
}

/**
 * Scrolls to the currently active node
 */
export function scrollToActiveNode(): void {
  const store = getActiveStore();
  if (!store) return;
  const activeNodeId = store.getState().activeNodeId;
  if (activeNodeId) {
    store.getState().actions.scrollToNode(activeNodeId);
  }
}

/**
 * Resets the remembered visual X position
 * Useful when clicking with mouse or performing other operations
 */
export function resetRememberedPosition(): void {
  const store = getActiveStore();
  if (store) {
    store.getState().actions.setRememberedVisualX(null);
  }
}
