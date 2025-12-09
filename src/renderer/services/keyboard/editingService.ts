import { getActiveStore, getActiveNodeElement } from './shared';
import { getCursorPosition } from '../cursorService';
import { matchesHotkey } from '../../data/hotkeyConfig';
import { convertToContentEditable, convertFromContentEditable } from '../../utils/contentConversion';

/**
 * Keyboard editing service
 * Handles all editing-related keyboard shortcuts
 */

/**
 * Get cursor position from a range's start or end point
 */
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

/**
 * Handle Enter key: create new sibling or split node at cursor
 */
function handleEnterKey(element: HTMLElement, store: StoreState, activeNodeId: string): void {
  const content = convertFromContentEditable(element);

  // Handle text selection: delete selected text and split at selection start
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
    store.actions.splitNode(activeNodeId, contentWithoutSelection, selStart);
    return;
  }

  const cursorPos = getCursorPosition(element);

  // Cursor at end: create empty sibling
  if (cursorPos >= content.length) {
    store.actions.createNode(activeNodeId);
    return;
  }

  // Cursor mid-content: split node
  store.actions.splitNode(activeNodeId, content, cursorPos);
}

/**
 * Handle delete node shortcut
 */
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

/**
 * Handles editing keyboard shortcuts
 */
function handleEditingShortcuts(event: KeyboardEvent): void {
  const activeStore = getActiveStore();
  const element = getActiveNodeElement();
  if (!element || !activeStore) return;

  const store = activeStore.getState();
  const activeNodeId = store.activeNodeId;
  if (!activeNodeId) return;

  const activeNode = store.nodes[activeNodeId];
  if (!activeNode) return;

  // Move node up
  if (matchesHotkey(event, 'navigation', 'moveNodeUp')) {
    event.preventDefault();
    store.actions.setCursorPosition(getCursorPosition(element));
    store.actions.moveNodeUp(activeNodeId);
    return;
  }

  // Move node down
  if (matchesHotkey(event, 'navigation', 'moveNodeDown')) {
    event.preventDefault();
    store.actions.setCursorPosition(getCursorPosition(element));
    store.actions.moveNodeDown(activeNodeId);
    return;
  }

  // Create new sibling without splitting (Ctrl+Enter)
  if (matchesHotkey(event, 'editing', 'newSiblingNoSplit')) {
    event.preventDefault();
    store.actions.createNode(activeNodeId);
    return;
  }

  // Create new sibling after (or split node if cursor is mid-content)
  if (matchesHotkey(event, 'editing', 'newSiblingAfter')) {
    event.preventDefault();
    // Link nodes: just create new sibling (no splitting)
    const isLinkNode = activeNode.metadata.isHyperlink === true || activeNode.metadata.isExternalLink === true;
    if (isLinkNode) {
      store.actions.createNode(activeNodeId);
      return;
    }
    handleEnterKey(element, store, activeNodeId);
    return;
  }

  // Outdent
  if (matchesHotkey(event, 'editing', 'outdent')) {
    event.preventDefault();
    store.actions.setCursorPosition(getCursorPosition(element));
    store.actions.setRememberedVisualX(null);
    store.actions.outdentNode(activeNodeId);
    return;
  }

  // Indent
  if (matchesHotkey(event, 'editing', 'indent')) {
    event.preventDefault();
    store.actions.setCursorPosition(getCursorPosition(element));
    store.actions.setRememberedVisualX(null);
    store.actions.indentNode(activeNodeId);
    return;
  }

  // Cancel edit
  if (matchesHotkey(event, 'editing', 'cancelEdit')) {
    event.preventDefault();
    convertToContentEditable(element, activeNode.content);
    element.blur();
    return;
  }

  // Delete node
  if (matchesHotkey(event, 'actions', 'deleteNode')) {
    event.preventDefault();
    store.actions.setCursorPosition(getCursorPosition(element));
    handleDeleteNode(store, activeNodeId);
    return;
  }

  // Expand/collapse node
  if (matchesHotkey(event, 'navigation', 'expandCollapse')) {
    event.preventDefault();
    store.actions.setCursorPosition(getCursorPosition(element));
    store.actions.toggleNode(activeNodeId);
    return;
  }

  // Toggle task status
  if (matchesHotkey(event, 'actions', 'toggleTaskStatus')) {
    event.preventDefault();
    store.actions.setCursorPosition(getCursorPosition(element));
    store.actions.toggleStatus(activeNodeId);
    return;
  }

  // Reset remembered X on typing
  if (event.key.length === 1 || event.key === 'Backspace' || event.key === 'Delete') {
    store.actions.setRememberedVisualX(null);
  }
}

/**
 * Main keyboard event handler for editing shortcuts
 */
function handleKeyDown(event: KeyboardEvent): void {
  const activeStore = getActiveStore();

  // Handle undo/redo (doesn't require active element)
  // Must preventDefault AND stopPropagation to prevent contentEditable native undo
  if (matchesHotkey(event, 'actions', 'undo')) {
    event.preventDefault();
    event.stopPropagation();
    if (activeStore) {
      activeStore.getState().actions.undo();
    }
    return;
  }

  if (matchesHotkey(event, 'actions', 'redo')) {
    event.preventDefault();
    event.stopPropagation();
    if (activeStore) {
      activeStore.getState().actions.redo();
    }
    return;
  }

  const element = getActiveNodeElement();
  if (!element) return;

  handleEditingShortcuts(event);
}

/**
 * Initializes the editing keyboard service
 * Call this once when the app starts
 */
export function initializeEditingService(target: HTMLElement | Window = window): () => void {
  target.addEventListener('keydown', handleKeyDown as EventListener, true);

  return () => {
    target.removeEventListener('keydown', handleKeyDown as EventListener, true);
  };
}
