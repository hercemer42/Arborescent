const PARTIAL_TEXT_SELECTION_SELECTORS = '[contenteditable], .node-text';

function getSelectionAnchorElement(): Element | null {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return null;

  const anchorNode = selection.anchorNode;
  if (!anchorNode) return null;

  return anchorNode.nodeType === Node.TEXT_NODE
    ? anchorNode.parentElement
    : (anchorNode as Element);
}

export function hasTextSelection(): boolean {
  const element = getSelectionAnchorElement();
  if (!element) return false;
  if (!window.getSelection()?.toString()) return false;
  return element.closest(PARTIAL_TEXT_SELECTION_SELECTORS) !== null;
}

export function isSelectionInContentEditable(): boolean {
  const element = getSelectionAnchorElement();
  if (!element) return false;
  return element.closest('[contenteditable]') !== null;
}

export function isSelectionInRichContent(): boolean {
  const element = getSelectionAnchorElement();
  if (!element) return false;
  const nodeText = element.closest('.node-text');
  return nodeText?.getAttribute('data-rich') === 'true';
}

export function getSelectionNodeId(): string | null {
  const element = getSelectionAnchorElement();
  if (!element) return null;
  const nodeElement = element.closest('[data-node-id]');
  return nodeElement?.getAttribute('data-node-id') ?? null;
}

export function selectionSpansSingleNode(): boolean {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed) return false;

  const anchorElement =
    selection.anchorNode?.nodeType === Node.TEXT_NODE
      ? selection.anchorNode.parentElement
      : (selection.anchorNode as Element | null);
  const focusElement =
    selection.focusNode?.nodeType === Node.TEXT_NODE
      ? selection.focusNode.parentElement
      : (selection.focusNode as Element | null);

  const anchorNodeId = anchorElement?.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null;
  const focusNodeId = focusElement?.closest('[data-node-id]')?.getAttribute('data-node-id') ?? null;

  return anchorNodeId === focusNodeId;
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

export function isFocusInTerminalOrBrowser(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  if (activeElement.tagName.toLowerCase() === 'webview') return true;
  if (activeElement.closest('.terminal-panel')) return true;
  if (activeElement.closest('.browser-panel')) return true;
  return false;
}

export function isInputOrTextareaFocused(): boolean {
  const activeElement = document.activeElement;
  if (!activeElement) return false;
  const tagName = activeElement.tagName.toLowerCase();
  return tagName === 'input' || tagName === 'textarea';
}
