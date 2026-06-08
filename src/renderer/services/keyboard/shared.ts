import type { TreeStore } from '../../store/tree/treeStore';
import { useFilesStore } from '../../store/files/filesStore';
import { storeManager } from '../../store/storeManager';
import { feedbackTreeStore } from '../../store/feedback/feedbackTreeStore';
import { parseZoomPath } from '../../utils/zoomPath';

export function getActiveStore(): TreeStore | null {
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

export interface KeyboardEditTarget {
  store: TreeStore;
  nodeId: string;
  element: HTMLElement;
}

// TreeNode marks the wrapper around an in-review node's inline proposition with this
// attribute, set to the reviewed node id. The proposition renders from a separate feedback
// store, so tree navigation and editing follow focus into that store. File / clipboard /
// send hotkeys deliberately keep using getActiveStore (the file store) instead.
const REVIEW_PROPOSITION_SELECTOR = '[data-review-proposition]';

function focusedPropositionStore(): TreeStore | null {
  const focused = document.activeElement;
  if (!(focused instanceof Element)) return null;
  const region = focused.closest(REVIEW_PROPOSITION_SELECTOR);
  if (!region) return null;
  const reviewedNodeId = region.getAttribute('data-review-proposition');
  return reviewedNodeId ? feedbackTreeStore.getStoreForNode(reviewedNodeId) : null;
}

export function getFocusedStore(): TreeStore | null {
  return focusedPropositionStore() ?? getActiveStore();
}

export function getFocusedNodeElement(): HTMLElement | null {
  const store = getFocusedStore();
  return store ? getActiveNodeElementForStore(store) : null;
}

export function getKeyboardEditTarget(): KeyboardEditTarget | null {
  const propositionStore = focusedPropositionStore();
  if (propositionStore) {
    const focused = document.activeElement as Element;
    const row = focused.closest('[data-node-id]');
    const nodeId = row?.getAttribute('data-node-id');
    const node = nodeId ? propositionStore.getState().nodes[nodeId] : undefined;
    // A removed row is a placeholder for a pending deletion; editing it is meaningless.
    if (!row || !nodeId || !node || node.metadata.feedbackBaselineKind === 'removed') return null;
    const element = row.querySelector('[contenteditable]') as HTMLElement | null;
    if (!element) return null;
    return { store: propositionStore, nodeId, element };
  }

  const store = getActiveStore();
  if (!store) return null;
  const nodeId = store.getState().activeNodeId;
  if (!nodeId) return null;
  const element = getActiveNodeElementForStore(store);
  if (!element) return null;
  return { store, nodeId, element };
}

export function scrollToActiveNode(): void {
  const store = getFocusedStore();
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
