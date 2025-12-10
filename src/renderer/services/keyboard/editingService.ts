import { getActiveStore, getActiveNodeElement } from './shared';
import { getCursorPosition } from '../cursorService';
import { matchesHotkey } from '../../data/hotkeyConfig';
import { convertToContentEditable, convertFromContentEditable } from '../../utils/contentConversion';

function getCursorPositionFromRange(element: HTMLElement, range: Range, useStart: boolean): number {
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  if (useStart) {
    preCaretRange.setEnd(range.startContainer, range.startOffset);
  } else {
    preCaretRange.setEnd(range.endContainer, range.endOffset);
  }
  return preCaretRange.toString().length;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type StoreState = ReturnType<NonNullable<ReturnType<typeof getActiveStore>>['getState']>;

function handleEnterKey(element: HTMLElement, store: StoreState, activeNodeId: string, createAsChild: boolean = false): void {
  const content = convertFromContentEditable(element);
  const activeNode = store.nodes[activeNodeId];
  const hasChildren = activeNode && activeNode.children.length > 0;
  const shouldCreateAsChild = createAsChild && hasChildren;

  const selection = window.getSelection();
  if (selection && !selection.isCollapsed) {
    const range = selection.getRangeAt(0);
    const selStart = Math.min(
      getCursorPositionFromRange(element, range, true),
      getCursorPositionFromRange(element, range, false)
    );
    const selEnd = Math.max(
      getCursorPositionFromRange(element, range, true),
      getCursorPositionFromRange(element, range, false)
    );
    const contentWithoutSelection = content.slice(0, selStart) + content.slice(selEnd);
    store.actions.splitNode(activeNodeId, contentWithoutSelection, selStart, shouldCreateAsChild);
    return;
  }

  const cursorPos = getCursorPosition(element);

  if (cursorPos === 0 && content.length > 0) {
    store.actions.createNodeBefore(activeNodeId);
    return;
  }

  if (cursorPos >= content.length) {
    if (shouldCreateAsChild) {
      store.actions.splitNode(activeNodeId, content, content.length, true);
    } else {
      store.actions.createNode(activeNodeId);
    }
    return;
  }

  store.actions.splitNode(activeNodeId, content, cursorPos, shouldCreateAsChild);
}

function handleDeleteNode(store: StoreState, activeNodeId: string): void {
  if (store.multiSelectedNodeIds && store.multiSelectedNodeIds.size > 0) {
    store.actions.deleteSelectedNodes();
    return;
  }

  const deleted = store.actions.deleteNode(activeNodeId);
  if (!deleted) {
    const confirmed = window.confirm(
      'This node has children. Deleting it will also delete all its children. Are you sure?'
    );
    if (confirmed) {
      store.actions.deleteNode(activeNodeId, true);
    }
  }
}

function handleEditingShortcuts(event: KeyboardEvent): void {
  const activeStore = getActiveStore();
  const element = getActiveNodeElement();
  if (!element || !activeStore) return;

  const store = activeStore.getState();
  const activeNodeId = store.activeNodeId;
  if (!activeNodeId) return;

  const activeNode = store.nodes[activeNodeId];
  if (!activeNode) return;

  if (matchesHotkey(event, 'navigation', 'moveNodeUp')) {
    event.preventDefault();
    store.actions.setCursorPosition(getCursorPosition(element));
    store.actions.moveNodeUp(activeNodeId);
    return;
  }

  if (matchesHotkey(event, 'navigation', 'moveNodeDown')) {
    event.preventDefault();
    store.actions.setCursorPosition(getCursorPosition(element));
    store.actions.moveNodeDown(activeNodeId);
    return;
  }

  if (matchesHotkey(event, 'editing', 'newSiblingAfter')) {
    event.preventDefault();
    // Link nodes can't be split
    const isLinkNode = activeNode.metadata.isHyperlink === true || activeNode.metadata.isExternalLink === true;
    if (isLinkNode) {
      store.actions.createNode(activeNodeId);
      return;
    }
    handleEnterKey(element, store, activeNodeId, true);
    return;
  }

  if (matchesHotkey(event, 'editing', 'newSiblingNoSplit')) {
    event.preventDefault();
    store.actions.createNode(activeNodeId);
    return;
  }

  if (matchesHotkey(event, 'editing', 'outdent')) {
    event.preventDefault();
    store.actions.setCursorPosition(getCursorPosition(element));
    store.actions.setRememberedVisualX(null);
    store.actions.outdentNode(activeNodeId);
    return;
  }

  if (matchesHotkey(event, 'editing', 'indent')) {
    event.preventDefault();
    store.actions.setCursorPosition(getCursorPosition(element));
    store.actions.setRememberedVisualX(null);
    store.actions.indentNode(activeNodeId);
    return;
  }

  if (matchesHotkey(event, 'editing', 'cancelEdit')) {
    event.preventDefault();
    convertToContentEditable(element, activeNode.content);
    element.blur();
    store.actions.clearSelection();
    return;
  }

  if (matchesHotkey(event, 'actions', 'deleteNode')) {
    event.preventDefault();
    store.actions.setCursorPosition(getCursorPosition(element));
    handleDeleteNode(store, activeNodeId);
    return;
  }

  if (matchesHotkey(event, 'navigation', 'expandCollapse')) {
    event.preventDefault();
    store.actions.setCursorPosition(getCursorPosition(element));
    store.actions.toggleNode(activeNodeId);
    return;
  }

  if (matchesHotkey(event, 'actions', 'toggleTaskStatus')) {
    event.preventDefault();
    store.actions.setCursorPosition(getCursorPosition(element));
    store.actions.toggleStatus(activeNodeId);
    return;
  }

  if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
    store.actions.setRememberedVisualX(null);
  }
}

function handleKeyDown(event: KeyboardEvent): void {
  const element = getActiveNodeElement();
  if (!element) return;

  handleEditingShortcuts(event);
}

export function initializeEditingService(target: HTMLElement | Window = window): () => void {
  target.addEventListener('keydown', handleKeyDown as EventListener, true);

  return () => {
    target.removeEventListener('keydown', handleKeyDown as EventListener, true);
  };
}
