import { getFocusedStore, getFocusedNodeElement, scrollToActiveNode, getEffectiveRootNodeId } from './shared';
import {
  isAtFirstLine,
  isAtLastLine,
  moveCursorUpOneLine,
  moveCursorDownOneLine,
  getCurrentCursorX,
} from './multilineHelpers';
import { getCursorPosition } from '../cursorService';
import { getRangeFromPoint } from '../../utils/position';
import { useHotkeyContextStore } from '../../store/hotkey/hotkeyContextStore';

const NAVIGATION_THROTTLE_MS = 50;
let lastNavigationTime = 0;

function navigateCrossNode(
  direction: 'up' | 'down',
  element: HTMLElement | null,
  targetX: number
): void {
  const activeStore = getFocusedStore();
  if (!activeStore) return;

  lastNavigationTime = Date.now();
  const store = activeStore.getState();
  const boundaryNodeId = getEffectiveRootNodeId() ?? undefined;

  const cursorPosition = direction === 'down' && element ? getCursorPosition(element) : undefined;

  if (direction === 'up') {
    store.actions.moveUp(cursorPosition, targetX, boundaryNodeId);
  } else {
    store.actions.moveDown(cursorPosition, targetX, boundaryNodeId);
  }

  scrollToActiveNode();
}

function moveCursorToLineStart(element: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const cursorRect = range.getBoundingClientRect();
  const lineY = cursorRect.top;
  const lineHeight = cursorRect.height || 20;
  const elementRect = element.getBoundingClientRect();

  let testX = cursorRect.left - 1;
  let lastValidRange = range;

  while (testX > elementRect.left) {
    const testRange = getRangeFromPoint(testX, lineY + lineHeight / 2);
    if (!testRange) break;

    const testRect = testRange.getBoundingClientRect();
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

function moveCursorToLineEnd(element: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const range = selection.getRangeAt(0);
  const cursorRect = range.getBoundingClientRect();
  const lineY = cursorRect.top;
  const lineHeight = cursorRect.height || 20;
  const elementRect = element.getBoundingClientRect();

  let testX = cursorRect.right + 1;
  let lastValidRange = range;

  while (testX < elementRect.right) {
    const testRange = getRangeFromPoint(testX, lineY + lineHeight / 2);
    if (!testRange) break;

    const testRect = testRange.getBoundingClientRect();
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

function handleVerticalNavigation(direction: 'up' | 'down', event: KeyboardEvent): void {
  event.preventDefault();

  const now = Date.now();
  if (now - lastNavigationTime < NAVIGATION_THROTTLE_MS) return;

  const activeStore = getFocusedStore();
  if (!activeStore) return;

  const element = getFocusedNodeElement();
  const store = activeStore.getState();
  const currentX = element ? getCurrentCursorX() : 0;
  const targetX = store.rememberedVisualX ?? currentX;

  if (!element) {
    navigateCrossNode(direction, null, targetX);
    return;
  }

  const atBoundary = direction === 'up' ? isAtFirstLine(element) : isAtLastLine(element);

  if (!atBoundary) {
    const moveFunction = direction === 'up' ? moveCursorUpOneLine : moveCursorDownOneLine;
    const moved = moveFunction(element, targetX);

    if (moved) {
      if (store.rememberedVisualX === null) {
        store.actions.setRememberedVisualX(currentX);
      }
      return;
    }
  }

  navigateCrossNode(direction, element, targetX);

  if (store.rememberedVisualX === null) {
    store.actions.setRememberedVisualX(currentX);
  }
}

function handleHorizontalNavigation(direction: 'left' | 'right', event: KeyboardEvent): void {
  const element = getFocusedNodeElement();
  const activeStore = getFocusedStore();
  if (!element || !activeStore) return;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const cursorPosition = getCursorPosition(element);
  const contentLength = element.textContent?.length ?? 0;
  const store = activeStore.getState();

  const atBoundary = (direction === 'left' && cursorPosition === 0) ||
                     (direction === 'right' && cursorPosition === contentLength);

  if (atBoundary) {
    event.preventDefault();
    store.actions.setRememberedVisualX(null);

    const boundaryNodeId = getEffectiveRootNodeId() ?? undefined;
    if (direction === 'left') {
      store.actions.moveBack(boundaryNodeId);
    } else {
      store.actions.moveForward(boundaryNodeId);
    }

    scrollToActiveNode();
  } else {
    store.actions.setRememberedVisualX(null);
  }
}

function handleLineNavigation(event: KeyboardEvent): void {
  const element = getFocusedNodeElement();
  const activeStore = getFocusedStore();
  if (!element || !activeStore) return;

  const store = activeStore.getState();

  if (event.key === 'Home' || event.key === 'End') {
    if (event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) {
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

  if (event.key === 'PageUp' || event.key === 'PageDown') {
    const capturedElement = element;
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

function isActiveLinkNode(): boolean {
  const activeStore = getFocusedStore();
  if (!activeStore) return false;

  const store = activeStore.getState();
  const activeNodeId = store.activeNodeId;
  if (!activeNodeId) return false;

  const node = store.nodes[activeNodeId];
  if (!node) return false;

  return node.metadata.isHyperlink === true || node.metadata.isExternalLink === true;
}

function handleLinkNodeNavigation(direction: 'up' | 'down' | 'left' | 'right', event: KeyboardEvent): void {
  event.preventDefault();

  const activeStore = getFocusedStore();
  if (!activeStore) return;

  const store = activeStore.getState();
  store.actions.setRememberedVisualX(null);
  const boundaryNodeId = getEffectiveRootNodeId() ?? undefined;

  if (direction === 'up' || direction === 'left') {
    store.actions.moveUp(undefined, 0, boundaryNodeId);
  } else {
    store.actions.moveDown(0, 0, boundaryNodeId);
  }

  scrollToActiveNode();
}

function handleKeyDown(event: KeyboardEvent): void {
  const { isInitialized, isHotkeyActiveInContext } = useHotkeyContextStore.getState();
  if (!isInitialized || !isHotkeyActiveInContext('tree')) {
    return;
  }

  const element = getFocusedNodeElement();
  if (!element) return;

  const activeStore = getFocusedStore();

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
    if (event.shiftKey) {
      if (activeStore) {
        activeStore.getState().actions.setRememberedVisualX(null);
      }
      return;
    }

    if (event.ctrlKey || event.metaKey || event.altKey) {
      if (activeStore) {
        activeStore.getState().actions.setRememberedVisualX(null);
      }
      return;
    }

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

  if (['Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
    handleLineNavigation(event);
    return;
  }
}

export function initializeNavigationService(target: HTMLElement | Window = window): () => void {
  target.addEventListener('keydown', handleKeyDown as EventListener, true);

  return () => {
    target.removeEventListener('keydown', handleKeyDown as EventListener, true);
  };
}
