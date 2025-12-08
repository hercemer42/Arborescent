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
    const position = getCursorPosition(element);
    store.actions.setCursorPosition(position);
    store.actions.moveNodeUp(activeNodeId);
    return;
  }

  // Move node down
  if (matchesHotkey(event, 'navigation', 'moveNodeDown')) {
    event.preventDefault();
    const position = getCursorPosition(element);
    store.actions.setCursorPosition(position);
    store.actions.moveNodeDown(activeNodeId);
    return;
  }

  // Create new sibling after (or split node if cursor is mid-content)
  if (matchesHotkey(event, 'editing', 'newSiblingAfter')) {
    event.preventDefault();

    // Get content from DOM and cursor position
    const content = convertFromContentEditable(element);
    let cursorPos = getCursorPosition(element);

    // Handle text selection: delete selected text and adjust cursor
    const selection = window.getSelection();
    if (selection && !selection.isCollapsed) {
      const selStart = Math.min(
        getCursorPositionFromRange(element, selection.getRangeAt(0), true),
        getCursorPositionFromRange(element, selection.getRangeAt(0), false)
      );
      const selEnd = Math.max(
        getCursorPositionFromRange(element, selection.getRangeAt(0), true),
        getCursorPositionFromRange(element, selection.getRangeAt(0), false)
      );
      // Remove selected text from content
      const contentWithoutSelection = content.slice(0, selStart) + content.slice(selEnd);
      cursorPos = selStart;
      // Split with selection removed
      store.actions.splitNode(activeNodeId, contentWithoutSelection, cursorPos);
      return;
    }

    // If cursor is at end of content, use standard createNode behavior
    if (cursorPos >= content.length) {
      store.actions.createNode(activeNodeId);
      return;
    }

    // Split node at cursor position
    store.actions.splitNode(activeNodeId, content, cursorPos);
    return;
  }

  // Outdent
  if (matchesHotkey(event, 'editing', 'outdent')) {
    event.preventDefault();
    const position = getCursorPosition(element);
    store.actions.setCursorPosition(position);
    store.actions.setRememberedVisualX(null);
    store.actions.outdentNode(activeNodeId);
    return;
  }

  // Indent
  if (matchesHotkey(event, 'editing', 'indent')) {
    event.preventDefault();
    const position = getCursorPosition(element);
    store.actions.setCursorPosition(position);
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

  // Delete node - delegate to deleteSelectedNodes which handles multi-selection
  if (matchesHotkey(event, 'actions', 'deleteNode')) {
    event.preventDefault();
    const position = getCursorPosition(element);
    store.actions.setCursorPosition(position);

    // Check if there's a multi-selection
    if (store.multiSelectedNodeIds && store.multiSelectedNodeIds.size > 0) {
      store.actions.deleteSelectedNodes();
      return;
    }

    // Single node deletion
    const deleted = store.actions.deleteNode(activeNodeId);
    if (!deleted) {
      const confirmed = window.confirm(
        'This node has children. Deleting it will also delete all its children. Are you sure?'
      );
      if (confirmed) {
        store.actions.deleteNode(activeNodeId, true);
      }
    }
    return;
  }

  // Expand/collapse node - CmdOrCtrl+T
  if (matchesHotkey(event, 'navigation', 'expandCollapse')) {
    event.preventDefault();
    const position = getCursorPosition(element);
    store.actions.setCursorPosition(position);
    store.actions.toggleNode(activeNodeId);
    return;
  }

  // Toggle task status
  if (matchesHotkey(event, 'actions', 'toggleTaskStatus')) {
    event.preventDefault();
    const position = getCursorPosition(element);
    store.actions.setCursorPosition(position);
    store.actions.toggleStatus(activeNodeId);
    return;
  }

  // Block text modification for hyperlink nodes
  // Allow navigation keys, shortcuts, but block typing/backspace/delete
  if (activeNode.metadata.isHyperlink === true) {
    const isTyping = event.key.length === 1 && !event.ctrlKey && !event.metaKey;
    const isTextDelete = (event.key === 'Backspace' || event.key === 'Delete') && !event.ctrlKey && !event.metaKey;

    if (isTyping || isTextDelete) {
      event.preventDefault();
      return;
    }
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
