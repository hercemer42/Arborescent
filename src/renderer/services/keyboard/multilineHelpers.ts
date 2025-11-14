import { getRangeFromPoint } from '../../utils/position';

/**
 * Detects if cursor is at the first line of a multiline element
 */
export function isAtFirstLine(element: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return true;

  const range = selection.getRangeAt(0);
  const cursorRect = range.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  // Empty nodes or collapsed cursors have zero-width/height rects
  // Treat them as single-line (at first line)
  if (cursorRect.width === 0 && cursorRect.height === 0) return true;

  // Check if node is effectively empty (no text content)
  const textContent = element.textContent || '';
  if (textContent.trim().length === 0) return true;

  const lineHeight = parseFloat(window.getComputedStyle(element).lineHeight) || 20;

  // Cursor is at first line if its Y position is within the first line height
  return cursorRect.top - elementRect.top < lineHeight / 2;
}

/**
 * Detects if cursor is at the last line of a multiline element
 */
export function isAtLastLine(element: HTMLElement): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return true;

  const range = selection.getRangeAt(0);
  const cursorRect = range.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  // Empty nodes or collapsed cursors have zero-width/height rects
  // Treat them as single-line (at last line)
  if (cursorRect.width === 0 && cursorRect.height === 0) return true;

  // Check if node is effectively empty (no text content)
  const textContent = element.textContent || '';
  if (textContent.trim().length === 0) return true;

  const lineHeight = parseFloat(window.getComputedStyle(element).lineHeight) || 20;

  // Cursor is at last line if its Y position is within the last line height
  return elementRect.bottom - cursorRect.bottom < lineHeight / 2;
}

/**
 * Moves cursor up one line within the same element
 * Returns true if successful, false if at first line
 */
export function moveCursorUpOneLine(element: HTMLElement, targetX: number): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  const cursorRect = range.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  const lineHeight = parseFloat(window.getComputedStyle(element).lineHeight) || 20;
  const currentY = cursorRect.top;
  const targetY = currentY - lineHeight;

  // Check if target Y would be above the element (with small tolerance)
  if (targetY < elementRect.top - lineHeight / 4) {
    return false; // Would move above element
  }

  // Position cursor at target coordinates (middle of target line)
  const targetRange = getRangeFromPoint(targetX, targetY + lineHeight / 2);
  if (targetRange) {
    // Verify the new position is actually within our element
    let node: Node | null = targetRange.startContainer;
    let isWithinElement = false;

    while (node) {
      if (node === element) {
        isWithinElement = true;
        break;
      }
      node = node.parentNode;
    }

    if (!isWithinElement) {
      return false; // Target is outside our element
    }

    selection.removeAllRanges();
    selection.addRange(targetRange);
    return true;
  }

  return false;
}

/**
 * Moves cursor down one line within the same element
 * Returns true if successful, false if at last line
 */
export function moveCursorDownOneLine(element: HTMLElement, targetX: number): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return false;

  const range = selection.getRangeAt(0);
  const cursorRect = range.getBoundingClientRect();
  const elementRect = element.getBoundingClientRect();

  const lineHeight = parseFloat(window.getComputedStyle(element).lineHeight) || 20;
  // Use cursorRect.top (not bottom) to get current line position
  const currentY = cursorRect.top;
  const targetY = currentY + lineHeight;

  // Check if target Y would be below the element (with small tolerance)
  if (targetY > elementRect.bottom + lineHeight / 4) {
    return false; // Would move below element
  }

  // Position cursor at target coordinates (middle of target line)
  const targetRange = getRangeFromPoint(targetX, targetY + lineHeight / 2);
  if (targetRange) {
    // Verify the new position is actually within our element
    let node: Node | null = targetRange.startContainer;
    let isWithinElement = false;

    while (node) {
      if (node === element) {
        isWithinElement = true;
        break;
      }
      node = node.parentNode;
    }

    if (!isWithinElement) {
      return false; // Target is outside our element
    }

    selection.removeAllRanges();
    selection.addRange(targetRange);
    return true;
  }

  return false;
}

/**
 * Gets the current horizontal cursor position (X coordinate)
 */
export function getCurrentCursorX(): number {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  return rect.left;
}

/**
 * Gets the left offset of an element (for handling indentation)
 */
export function getElementLeftOffset(element: HTMLElement): number {
  return element.getBoundingClientRect().left;
}
