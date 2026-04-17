export function capturePreviouslyFocusedElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  if (active === document.body) return null;
  return active;
}

export function restoreFocusAfterPaint(element: HTMLElement): void {
  if (typeof requestAnimationFrame === 'undefined') return;
  requestAnimationFrame(() => {
    if (!document.contains(element)) return;
    if (document.activeElement === element) return;
    element.focus();
  });
}

export function preserveFocusAcross<T>(operation: () => T): T {
  const previouslyFocused = capturePreviouslyFocusedElement();
  const result = operation();
  if (previouslyFocused) {
    restoreFocusAfterPaint(previouslyFocused);
  }
  return result;
}
