/**
 * Utilities for detecting text selection and contenteditable focus
 */

/**
 * Check if there's text selected in an active contenteditable element
 */
export function hasTextSelection(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;

  const anchorNode = selection.anchorNode;
  if (!anchorNode) return false;

  const element =
    anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : (anchorNode as Element);

  return element?.closest('[contenteditable="true"]') !== null;
}

/**
 * Check if a contenteditable element is currently focused
 */
export function isContentEditableFocused(): boolean {
  const activeElement = document.activeElement;
  return activeElement?.getAttribute('contenteditable') === 'true';
}
