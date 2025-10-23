export const getCursorPosition = (element: HTMLElement): number => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  const preCaretRange = range.cloneRange();
  preCaretRange.selectNodeContents(element);
  preCaretRange.setEnd(range.endContainer, range.endOffset);
  return preCaretRange.toString().length;
};

export const getVisualCursorPosition = (): number => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return 0;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  return rect.left;
};

export const setCursorPosition = (element: HTMLElement, position: number) => {
  const range = document.createRange();
  const selection = window.getSelection();

  let charCount = 0;
  let found = false;

  const traverseNodes = (node: ChildNode): boolean => {
    if (node.nodeType === window.Node.TEXT_NODE) {
      const textLength = node.textContent?.length || 0;
      if (charCount + textLength >= position) {
        range.setStart(node, position - charCount);
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

export const setCursorToVisualPosition = (element: HTMLElement, targetX: number): number => {
  const text = element.textContent || '';
  const contentLength = text.length;

  if (contentLength === 0) {
    setCursorPosition(element, 0);
    return 0;
  }

  let left = 0;
  let right = contentLength;
  let bestPosition = 0;
  let bestDistance = Infinity;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    setCursorPosition(element, mid);
    const currentX = getVisualCursorPosition();
    const distance = Math.abs(currentX - targetX);

    if (distance < bestDistance) {
      bestDistance = distance;
      bestPosition = mid;
    }

    if (currentX < targetX) {
      left = mid + 1;
    } else if (currentX > targetX) {
      right = mid - 1;
    } else {
      break;
    }
  }

  setCursorPosition(element, bestPosition);
  return bestPosition;
};
