import { getRangeFromPoint } from '../utils/position';

export const getCursorPosition = (element: HTMLElement): number => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
};

export const setCursorPosition = (element: HTMLElement, position: number) => {
  const range = document.createRange();
  const selection = window.getSelection();

  // Ensure there's at least an empty text node for cursor placement
  if (element.childNodes.length === 0) {
    element.appendChild(document.createTextNode(''));
  }

  let charCount = 0;
  let found = false;

  const traverseNodes = (node: ChildNode): boolean => {
    if (node.nodeType === window.Node.TEXT_NODE) {
      const textLength = node.textContent?.length || 0;
      if (charCount + textLength >= position) {
        range.setStart(node, Math.min(position - charCount, textLength));
        range.collapse(true);
        found = true;
        return true;
      }
      charCount += textLength;
    } else {
      for (const childNode of Array.from(node.childNodes)) {
        if (traverseNodes(childNode)) return true;
      }
    }
    return false;
  };

  for (const childNode of Array.from(element.childNodes)) {
    if (traverseNodes(childNode)) break;
  }

  if (!found && element.childNodes.length > 0) {
    const lastNode = element.childNodes[element.childNodes.length - 1];
    if (lastNode.nodeType === window.Node.TEXT_NODE) {
      range.setStart(lastNode, lastNode.textContent?.length || 0);
    } else {
      range.setStartAfter(lastNode);
    }
    range.collapse(true);
  }

  selection?.removeAllRanges();
  selection?.addRange(range);
};

function isWithinElement(range: Range, element: HTMLElement): boolean {
  let node: Node | null = range.startContainer;
  while (node) {
    if (node === element) return true;
    node = node.parentNode;
  }
  return false;
}

export const setCursorToVisualPositionOnLine = (
  element: HTMLElement,
  targetX: number,
  initialPosition: number
): void => {
  const elementRect = element.getBoundingClientRect();

  // Boundary case: targetX left of content (indentation)
  if (targetX < elementRect.left) {
    setCursorPosition(element, 0);
    return;
  }

  // Set cursor at initial position to get the line's Y coordinate
  setCursorPosition(element, initialPosition);
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return;

  const initialRange = selection.getRangeAt(0);
  const initialRect = initialRange.getBoundingClientRect();
  const initialY = initialRect.top;
  const lineHeight = parseFloat(window.getComputedStyle(element).lineHeight) || 20;

  // Try to place cursor at targetX on the same line
  const targetRange = getRangeFromPoint(targetX, initialY + lineHeight / 2);
  if (!targetRange) return;

  // Validate: must be within element and on same line
  if (!isWithinElement(targetRange, element)) return;

  const targetY = targetRange.getBoundingClientRect().top;
  const yDifference = Math.abs(targetY - initialY);
  if (yDifference > lineHeight * 0.75) return;

  // Valid position found - set it
  selection.removeAllRanges();
  selection.addRange(targetRange);
};
