/**
 * Utilities for detecting text selection and contenteditable focus
 */

/**
 * Check if there's text selected in an active contenteditable element
 */
export function hasTextSelection(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;

  // Check if selection has actual content
  const selectedText = selection.toString();
  if (!selectedText) return false;

  const anchorNode = selection.anchorNode;
  if (!anchorNode) return false;

  const element =
    anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : (anchorNode as Element);

  // Check for contenteditable attribute (handles both "true" and "" values)
  return element?.closest('[contenteditable]') !== null;
}

/**
 * Check if a contenteditable element is currently focused
 */
export function isContentEditableFocused(): boolean {
  const activeElement = document.activeElement;
  // Check for any contenteditable attribute (handles both "true" and "" values)
  return activeElement?.hasAttribute('contenteditable') ?? false;
}
