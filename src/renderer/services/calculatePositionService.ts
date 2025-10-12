/**
 * Calculate cursor position from click coordinates.
 *
 * This function maps a click's X/Y coordinates to the nearest character position
 * in a contentEditable element by measuring the distance to each character.
 *
 * @param element - The contentEditable element containing text
 * @param clientX - X coordinate of the click
 * @param clientY - Y coordinate of the click (currently unused, but may be useful for multiline)
 * @returns The character index (0-based) closest to the click position
 */
export function getPositionFromCoordinates(
  element: HTMLElement,
  clientX: number,
  clientY: number // eslint-disable-line @typescript-eslint/no-unused-vars
): number {
  const textContent = element.textContent || '';

  const rect = element.getBoundingClientRect();

  // If click is before the element, return 0
  if (clientX < rect.left) {
    return 0;
  }

  // If click is after the element, return end position
  if (clientX > rect.right) {
    return textContent.length;
  }

  // Find the character position closest to click
  let bestPosition = 0;
  let minDistance = Infinity;

  // Create a range to measure character positions
  const range = document.createRange();
  const textNode = element.firstChild;

  if (!textNode || textNode.nodeType !== Node.TEXT_NODE) {
    return 0;
  }

  // Check each character position
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
