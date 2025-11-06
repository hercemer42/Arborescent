type VerticalDirection = 'up' | 'down';

export function getPositionFromCoordinates(
  element: HTMLElement,
  clientX: number,
): number {
  const textContent = element.textContent || '';

  const rect = element.getBoundingClientRect();

  if (clientX < rect.left) {
    return 0;
  }

  if (clientX > rect.right) {
    return textContent.length;
  }

  let bestPosition = 0;
  let minDistance = Infinity;

  const range = document.createRange();
  const textNode = element.firstChild;

  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    return 0;
  }

  for (let i = 0; i <= textContent.length; i++) {
    range.setStart(textNode, i);
    range.setEnd(textNode, i);

    const charRect = range.getBoundingClientRect();
    const distance = Math.abs(charRect.left - clientX);

    if (distance < minDistance) {
      minDistance = distance;
      bestPosition = i;
    }
  }

  return bestPosition;
}

function isAtVerticalBoundary(
  direction: VerticalDirection,
  cursorY: number,
  lineHeight: number,
  elementTop: number,
  elementBottom: number
): boolean {
  const checkY = direction === 'up'
    ? cursorY - lineHeight / 2
    : cursorY + lineHeight + lineHeight / 2;

  return direction === 'up'
    ? checkY < elementTop
    : checkY > elementBottom;
}

export function detectVerticalBoundary(
  element: HTMLElement,
  direction: VerticalDirection
): { isAtBoundary: boolean; cursorX: number } | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  const cursorX = rect.left;
  const cursorY = rect.top;

  const elementRect = element.getBoundingClientRect();
  const lineHeight = parseFloat(window.getComputedStyle(element).lineHeight) || 20;

  const isAtBoundary = isAtVerticalBoundary(
    direction,
    cursorY,
    lineHeight,
    elementRect.top,
    elementRect.bottom
  );

  return { isAtBoundary, cursorX };
}

interface CaretPosition {
  readonly offsetNode: Node;
  readonly offset: number;
}

type DocumentWithCaretPosition = Document & {
  caretPositionFromPoint?: (x: number, y: number) => CaretPosition | null;
};

export function getRangeFromPoint(x: number, y: number): Range | null {
  const doc = document as DocumentWithCaretPosition;
  if (!doc.caretPositionFromPoint) return null;

  const position = doc.caretPositionFromPoint(x, y);
  if (!position) return null;

  const range = document.createRange();
  range.setStart(position.offsetNode, position.offset);
  range.collapse(true);
  return range;
}
