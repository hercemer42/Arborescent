import { getActiveStore, getActiveNodeElement } from './shared';
import { getCursorPosition } from '../cursorService';
import { matchesHotkey } from '../../data/hotkeyConfig';
import { convertToContentEditable } from '../../utils/contentConversion';

/**
 * Keyboard editing service
 * Handles all editing-related keyboard shortcuts
 */

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

  // Create new sibling after
  if (matchesHotkey(event, 'editing', 'newSiblingAfter')) {
    event.preventDefault();
    store.actions.createNode(activeNodeId);
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

  // Delete node
  if (matchesHotkey(event, 'actions', 'deleteNode')) {
    event.preventDefault();
    const position = getCursorPosition(element);
    store.actions.setCursorPosition(position);

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

  // Toggle node (expand/collapse)
  if (matchesHotkey(event, 'navigation', 'toggleNode')) {
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
  if (matchesHotkey(event, 'actions', 'undo')) {
    event.preventDefault();
    if (activeStore) {
      activeStore.getState().actions.undo();
    }
    return;
  }

  if (matchesHotkey(event, 'actions', 'redo')) {
    event.preventDefault();
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
