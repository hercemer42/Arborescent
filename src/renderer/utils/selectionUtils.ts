export function hasTextSelection(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;

  const selectedText = selection.toString();
  if (!selectedText) return false;

  const anchorNode = selection.anchorNode;
  if (!anchorNode) return false;

  const element =
    anchorNode.nodeType === Node.TEXT_NODE ? anchorNode.parentElement : (anchorNode as Element);

  return element?.closest('[contenteditable]') !== null;
}

export function isContentEditableFocused(): boolean {
  const activeElement = document.activeElement;
  return activeElement?.hasAttribute('contenteditable') ?? false;
}

export function isFocusInPanel(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  if (activeElement.tagName.toLowerCase() === 'webview') return true;
  return activeElement.closest('.unified-panel') !== null;
}
