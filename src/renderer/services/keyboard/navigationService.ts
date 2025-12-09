import { getActiveStore, getActiveNodeElement, scrollToActiveNode } from './shared';
import {
  isAtFirstLine,
  isAtLastLine,
  moveCursorUpOneLine,
  moveCursorDownOneLine,
  getCurrentCursorX,
} from './multilineHelpers';
import { getCursorPosition } from '../cursorService';
import { getRangeFromPoint } from '../../utils/position';

/**
 * Keyboard navigation service
 * Handles arrow keys, Home/End, and PageUp/PageDown
 */

const NAVIGATION_THROTTLE_MS = 50;
let lastNavigationTime = 0;

/**
 * Navigates to the previous or next node (cross-node navigation)
 */
function navigateCrossNode(
  direction: 'up' | 'down',
  element: HTMLElement | null,
  targetX: number
): void {
  const activeStore = getActiveStore();
  if (!activeStore) return;

  lastNavigationTime = Date.now();
  const store = activeStore.getState();

  // For moveDown: start at beginning, For moveUp: start at end (undefined)
  const cursorPosition = direction === 'down' && element ? getCursorPosition(element) : undefined;

  if (direction === 'up') {
    store.actions.moveUp(cursorPosition, targetX);
  } else {
    store.actions.moveDown(cursorPosition, targetX);
  }

  scrollToActiveNode();
}

/**
 * Moves cursor to the start of the current line
 */
function moveCursorToLineStart(element: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const cursorRect = range.getBoundingClientRect();
  const lineY = cursorRect.top;
  const lineHeight = cursorRect.height || 20;
  const elementRect = element.getBoundingClientRect();

  // Start from cursor and scan left to find line start
  let testX = cursorRect.left - 1;
  let lastValidRange = range;

  while (testX > elementRect.left) {
    const testRange = getRangeFromPoint(testX, lineY + lineHeight / 2);
    if (!testRange) break;

    const testRect = testRange.getBoundingClientRect();
    // Check if still on the same line (within tolerance)
    if (Math.abs(testRect.top - lineY) > lineHeight * 0.5) {
      break;
    }

    lastValidRange = testRange;
    testX -= 1;
  }

  selection.removeAllRanges();
  selection.addRange(lastValidRange);
  lastValidRange.collapse(true);
}

/**
 * Moves cursor to the end of the current line
 */
function moveCursorToLineEnd(element: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const cursorRect = range.getBoundingClientRect();
  const lineY = cursorRect.top;
  const lineHeight = cursorRect.height || 20;
  const elementRect = element.getBoundingClientRect();

  // Start from cursor and scan right to find line end
  let testX = cursorRect.right + 1;
  let lastValidRange = range;

  while (testX < elementRect.right) {
    const testRange = getRangeFromPoint(testX, lineY + lineHeight / 2);
    if (!testRange) break;

    const testRect = testRange.getBoundingClientRect();
    // Check if still on the same line (within tolerance)
    if (Math.abs(testRect.top - lineY) > lineHeight * 0.5) {
      break;
    }

    lastValidRange = testRange;
    testX += 1;
  }

  selection.removeAllRanges();
  selection.addRange(lastValidRange);
  lastValidRange.collapse(false);
}

/**
 * Handles vertical navigation (up/down arrow keys)
 */
function handleVerticalNavigation(direction: 'up' | 'down', event: KeyboardEvent): void {
  event.preventDefault();

  // Throttle navigation
  const now = Date.now();
  if (now - lastNavigationTime < NAVIGATION_THROTTLE_MS) return;

  const activeStore = getActiveStore();
  if (!activeStore) return;

  const element = getActiveNodeElement();
  const store = activeStore.getState();
  const currentX = element ? getCurrentCursorX() : 0;
  const targetX = store.rememberedVisualX ?? currentX;

  // No element or empty node - navigate to next/prev node
  if (!element) {
    navigateCrossNode(direction, null, targetX);
    return;
  }

  // Check if at boundary
  const atBoundary = direction === 'up' ? isAtFirstLine(element) : isAtLastLine(element);

  // Try to move within node if not at boundary
  if (!atBoundary) {
    const moveFunction = direction === 'up' ? moveCursorUpOneLine : moveCursorDownOneLine;
    const moved = moveFunction(element, targetX);

    if (moved) {
      // Remember X position on first vertical movement
      if (store.rememberedVisualX === null) {
        store.actions.setRememberedVisualX(currentX);
      }
      return;
    }
  }

  // At boundary - navigate to next/prev node
  navigateCrossNode(direction, element, targetX);

  // Remember X position on first cross-node navigation
  if (store.rememberedVisualX === null) {
    store.actions.setRememberedVisualX(currentX);
  }
}

/**
 * Handles horizontal navigation (left/right arrow keys)
 */
function handleHorizontalNavigation(direction: 'left' | 'right', event: KeyboardEvent): void {
  const element = getActiveNodeElement();
  const activeStore = getActiveStore();
  if (!element || !activeStore) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const cursorPosition = getCursorPosition(element);
  const contentLength = element.textContent?.length ?? 0;
  const store = activeStore.getState();

  // Check if at boundary
  const atBoundary = (direction === 'left' && cursorPosition === 0) ||
                     (direction === 'right' && cursorPosition === contentLength);

  if (atBoundary) {
    event.preventDefault();
    store.actions.setRememberedVisualX(null);

    if (direction === 'left') {
      store.actions.moveBack();
    } else {
      store.actions.moveForward();
    }

    scrollToActiveNode();
  } else {
    // Let browser handle the cursor movement, just reset rememberedVisualX
    // The cursor position will sync via the selection change or blur handler
    store.actions.setRememberedVisualX(null);
  }
}

/**
 * Handles Home/End/PageUp/PageDown keys
 */
function handleLineNavigation(event: KeyboardEvent): void {
  const element = getActiveNodeElement();
  const activeStore = getActiveStore();
  if (!element || !activeStore) return;

  const store = activeStore.getState();

  // Handle Home/End keys manually to stay on current line
  if (event.key === 'Home' || event.key === 'End') {
    // Don't handle these keys if modifiers are pressed (Ctrl+Home/End for start/end of content)
    if (event.ctrlKey || event.metaKey || event.altKey) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (event.key === 'Home') {
      moveCursorToLineStart(element);
    } else {
      moveCursorToLineEnd(element);
    }

    store.actions.setRememberedVisualX(null);
    return;
  }

  // Reset remembered X and update cursor position for PageUp/PageDown
  if (event.key === 'PageUp' || event.key === 'PageDown') {
    // Capture element before async operation
    const capturedElement = element;
    // Let browser handle the key first, then sync cursor position
    setTimeout(() => {
      if (!capturedElement || !activeStore) return;
      const newPosition = getCursorPosition(capturedElement);
      const currentStore = activeStore.getState();
      currentStore.actions.setCursorPosition(newPosition);
      currentStore.actions.setRememberedVisualX(null);
    }, 0);
    return;
  }
}

/**
 * Check if the active node is a link (hyperlink or external link)
 */
function isActiveLinkNode(): boolean {
  const activeStore = getActiveStore();
  if (!activeStore) return false;

  const store = activeStore.getState();
  const activeNodeId = store.activeNodeId;
  if (!activeNodeId) return false;

  const node = store.nodes[activeNodeId];
  if (!node) return false;

  return node.metadata.isHyperlink === true || node.metadata.isExternalLink === true;
}

/**
 * Handle navigation for link nodes (non-editable, immediate cross-node nav)
 */
function handleLinkNodeNavigation(direction: 'up' | 'down' | 'left' | 'right', event: KeyboardEvent): void {
  event.preventDefault();

  const activeStore = getActiveStore();
  if (!activeStore) return;

  const store = activeStore.getState();
  store.actions.setRememberedVisualX(null);

  if (direction === 'up' || direction === 'left') {
    store.actions.moveUp(undefined, 0);
  } else {
    store.actions.moveDown(0, 0);
  }

  scrollToActiveNode();
}

/**
 * Main keyboard event handler for navigation
 */
function handleKeyDown(event: KeyboardEvent): void {
  const element = getActiveNodeElement();
  if (!element) return;

  const activeStore = getActiveStore();

  // Handle arrow keys with special navigation logic
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    // Don't interfere with text selection
    if (event.shiftKey) {
      if (activeStore) {
        activeStore.getState().actions.setRememberedVisualX(null);
      }
      return;
    }

    // Don't handle if any modifier key is pressed (except Shift which we already checked)
    if (event.ctrlKey || event.metaKey || event.altKey) {
      if (activeStore) {
        activeStore.getState().actions.setRememberedVisualX(null);
      }
      return;
    }

    // Link nodes: immediate cross-node navigation (no cursor within node)
    if (isActiveLinkNode()) {
      const direction = event.key === 'ArrowUp' ? 'up' :
                       event.key === 'ArrowDown' ? 'down' :
                       event.key === 'ArrowLeft' ? 'left' : 'right';
      handleLinkNodeNavigation(direction, event);
      return;
    }

    switch (event.key) {
      case 'ArrowUp':
        handleVerticalNavigation('up', event);
        break;
      case 'ArrowDown':
        handleVerticalNavigation('down', event);
        break;
      case 'ArrowLeft':
        handleHorizontalNavigation('left', event);
        break;
      case 'ArrowRight':
        handleHorizontalNavigation('right', event);
        break;
    }
    return;
  }

  // Handle Home/End/PageUp/PageDown
  if (['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
    handleLineNavigation(event);
    return;
  }
}

/**
 * Initializes the navigation keyboard service
 * @param target - The element to attach keyboard listeners to
 */
export function initializeNavigationService(target: HTMLElement | Window = window): () => void {
  target.addEventListener('keydown', handleKeyDown as EventListener, true);

  return () => {
    target.removeEventListener('keydown', handleKeyDown as EventListener, true);
  };
}
