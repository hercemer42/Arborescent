import { logger } from './logger';

const focusHandlers = new Map<string, () => void>();

export function registerTerminalFocus(id: string, focusFn: () => void): void {
  focusHandlers.set(id, focusFn);
}

export function unregisterTerminalFocus(id: string): void {
  focusHandlers.delete(id);
}

export function focusTerminal(id: string): void {
  const focusFn = focusHandlers.get(id);
  if (!focusFn) return;

  const schedule = typeof requestAnimationFrame === 'function'
    ? requestAnimationFrame
    : (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 0);

  schedule(() => {
    try {
      focusFn();
    } catch (error) {
      logger.warn(`Terminal focus handler threw for id=${id}: ${(error as Error).message}`, 'TerminalFocusRegistry');
    }
  });
}
