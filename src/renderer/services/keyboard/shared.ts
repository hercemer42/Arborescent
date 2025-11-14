import type { TreeStore } from '../../store/tree/treeStore';
import { getCursorPosition } from '../cursorService';

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
 * Handles mouse clicks to reset remembered position and sync cursor position
 */
export function handleMouseDown(): void {
  if (!activeStore) return;

  const element = getActiveNodeElement();
  if (!element) return;

  // Let browser handle click, then sync cursor position
  setTimeout(() => {
    if (!element || !activeStore) return;
    const position = getCursorPosition(element);
    const store = activeStore.getState();
    store.actions.setCursorPosition(position);
    store.actions.setRememberedVisualX(null);
  }, 0);
}

/**
 * Initializes mouse event handlers for cursor position sync
 * @param target - The element to attach mouse listeners to
 */
export function initializeMouseHandlers(target: HTMLElement | Window = window): () => void {
  target.addEventListener('mousedown', handleMouseDown, true);

  return () => {
    target.removeEventListener('mousedown', handleMouseDown, true);
  };
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
