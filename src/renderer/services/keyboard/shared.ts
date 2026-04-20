import type { TreeStore } from '../../store/tree/treeStore';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';
import { parseZoomPath } from '../../utils/zoomPath';

let activeFeedbackStore: TreeStore | null = null;

export function setActiveFeedbackStore(store: TreeStore | null): void {
  activeFeedbackStore = store;
}

function isFocusInFeedbackPanel(): boolean {
  return !!document.activeElement?.closest('.feedback-panel');
}

export function getActiveStore(): TreeStore | null {
  if (isFocusInFeedbackPanel()) {
    return activeFeedbackStore;
  }

  const activeFilePath = useFilesStore.getState().activeFilePath;
  if (!activeFilePath) return null;

  return storeManager.getStoreForFile(activeFilePath);
}

export function getActiveNodeElementForStore(store: TreeStore): HTMLElement | null {
  const activeNodeId = store.getState().activeNodeId;
  if (!activeNodeId) return null;

  const element = document.querySelector(
    `[data-node-id="${activeNodeId}"] [contenteditable]`
  ) as HTMLElement | null;

  return element;
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

export function getEffectiveRootNodeId(): string | null {
  const activeFilePath = useFilesStore.getState().activeFilePath;
  if (!activeFilePath) return null;
  const zoomInfo = parseZoomPath(activeFilePath);
  return zoomInfo?.nodeId ?? null;
}

export function resetRememberedPosition(): void {
  const store = getActiveStore();
  if (store) {
    store.getState().actions.setRememberedVisualX(null);
  }
}
