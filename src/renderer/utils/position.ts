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
