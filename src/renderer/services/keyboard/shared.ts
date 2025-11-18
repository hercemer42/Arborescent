import type { TreeStore } from '../../store/tree/treeStore';

/**
 * Shared utilities for keyboard services
 */

// Reference to the currently active tree store
let activeStore: TreeStore | null = null;

/**
 * Sets the active tree store for keyboard services
 * Call this when the active file/store changes
 */
export function setActiveStore(store: TreeStore | null): void {
  activeStore = store;
}

/**
 * Gets the current active store
 */
export function getActiveStore(): TreeStore | null {
  return activeStore;
}

/**
 * Gets the active node's contentEditable element
 */
export function getActiveNodeElement(): HTMLElement | null {
  if (!activeStore) return null;

  const activeNodeId = activeStore.getState().activeNodeId;
  if (!activeNodeId) return null;

  const element = document.querySelector(
    `[data-node-id="${activeNodeId}"] [contenteditable="true"]`
  ) as HTMLElement | null;

  return element;
}

/**
 * Scrolls to the currently active node
 */
export function scrollToActiveNode(): void {
  if (!activeStore) return;
  const activeNodeId = activeStore.getState().activeNodeId;
  if (activeNodeId) {
    activeStore.getState().actions.scrollToNode(activeNodeId);
  }
}

/**
 * Resets the remembered visual X position
 * Useful when clicking with mouse or performing other operations
 */
export function resetRememberedPosition(): void {
  if (activeStore) {
    activeStore.getState().actions.setRememberedVisualX(null);
  }
}
