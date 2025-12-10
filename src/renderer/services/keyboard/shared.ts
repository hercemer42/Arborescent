import type { TreeStore } from '../../store/tree/treeStore';
import { getStoreForFocusedElement } from '../treeContainerRegistry';

export function getActiveNodeElementForStore(store: TreeStore): HTMLElement | null {
  const activeNodeId = store.getState().activeNodeId;
  if (!activeNodeId) return null;

  const element = document.querySelector(
    `[data-node-id="${activeNodeId}"] [contenteditable]`
  ) as HTMLElement | null;

  return element;
}

export function getActiveStore(): TreeStore | null {
  return getStoreForFocusedElement();
}

export function getActiveNodeElement(): HTMLElement | null {
  const store = getActiveStore();
  if (!store) return null;
  return getActiveNodeElementForStore(store);
}

export function scrollToActiveNode(): void {
  const store = getActiveStore();
  if (!store) return;
  const activeNodeId = store.getState().activeNodeId;
  if (activeNodeId) {
    store.getState().actions.scrollToNode(activeNodeId);
  }
}

export function resetRememberedPosition(): void {
  const store = getActiveStore();
  if (store) {
    store.getState().actions.setRememberedVisualX(null);
  }
}
