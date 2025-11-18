interface CaretPosition {
  readonly offsetNode: Node;
  readonly offset: number;
}

type DocumentWithCaretPosition = Document & {
  caretPositionFromPoint?: (x: number, y: number) => CaretPosition | null;
};

type DocumentWithCaretRange = Document & {
  caretRangeFromPoint?: (x: number, y: number) => Range | null;
};

export function getRangeFromPoint(x: number, y: number): Range | null {
  // Try caretRangeFromPoint first (Chrome/Safari/Edge)
  const docWithCaretRange = document as DocumentWithCaretRange;
  if (docWithCaretRange.caretRangeFromPoint) {
    return docWithCaretRange.caretRangeFromPoint(x, y);
  }

  // Fall back to caretPositionFromPoint (Firefox)
  const doc = document as DocumentWithCaretPosition;
  if (!doc.caretPositionFromPoint) return null;

  const position = doc.caretPositionFromPoint(x, y);
  if (!position) return null;

  const range = document.createRange();
  range.setStart(position.offsetNode, position.offset);
  range.collapse(true);
  return range;
}

export function getPositionFromPoint(
  element: HTMLElement,
  clientX: number,
  clientY: number
): number {
  const textContent = element.textContent || '';
  const range = getRangeFromPoint(clientX, clientY);

  if (!range) {
    return 0;
  }

  // Verify the range is within the target element
  let node: Node | null = range.startContainer;
  let isWithinElement = false;
  while (node) {
    if (node === element) {
      isWithinElement = true;
      break;
    }
    node = node.parentNode;
  }

  if (!isWithinElement) {
    const rect = element.getBoundingClientRect();
    if (clientX < rect.left) {
      return 0;
    }
    if (clientX > rect.right) {
      return textContent.length;
    }
    return 0;
  }

  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
}
